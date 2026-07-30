#!/usr/bin/env bash
# Companion NuGet binary-compat gate.
#
# The in-tree tests (framework + Markdown Tests + demos) all recompile the
# core via <ProjectReference>, so an in-tree source rebuild fixes any ctor
# drift automatically — the gate cannot see a downstream binary break.
# The failure mode this closes: a companion NuGet packed against core vN,
# installed into a consumer that ALSO installs core v(N+1) from the registry,
# throws MissingMethodException at first-real-use because the companion's
# baked IL references a ctor signature the newer core no longer offers.
#
# What this gate does: packs core + every companion from the current tree,
# installs them from a local NuGet source into a throwaway consumer, and
# constructs one of every node the companion builds. Any MissingMethodException
# fails the build.
#
# Precedent for the failure this closes: Markdown 0.2.0 (compiled against
# VMS 7.0.0) crashed under VMS 8.0.0 because TextNode gained a 7th positional
# ctor param (COMP-02) and ListNode gained a 4th (COMP-05a). Amelia surfaced
# it via the relay on 2026-07-30; fixed by Markdown 0.2.1. This gate exists
# so that class of miss is caught in CI, not by a downstream consumer.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CORE_CSPROJ="$REPO_ROOT/viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj"

command -v dotnet >/dev/null || { echo "dotnet not on PATH — add ~/.dotnet to PATH"; exit 2; }

TMP="$(mktemp -d -t vms-companion-compat-XXXXXX)"
trap 'rm -rf "$TMP"' EXIT

FEED="$TMP/local-feed"
mkdir -p "$FEED"

echo "== Pack core =="
dotnet pack -c Release "$CORE_CSPROJ" -o "$FEED" --nologo -v q > "$TMP/pack-core.log" 2>&1 || {
  echo "core pack failed:"; cat "$TMP/pack-core.log"; exit 1;
}

# Discover every companion csproj under viewmodel-shell-dotnet/*/ that carries a
# <ProjectReference> to the core csproj — the exact predicate for "this package
# is compiled AGAINST the core and could be affected by a ctor break." Adding a
# new companion package requires no edit to this gate.
COMPANIONS=()
while IFS= read -r csproj; do
  # Skip the core itself; skip Tests projects.
  [ "$csproj" = "$CORE_CSPROJ" ] && continue
  case "$csproj" in *Tests*) continue;; esac
  if grep -q 'ProjectReference.*AshleyShrok\.ViewModelShell\.csproj' "$csproj"; then
    COMPANIONS+=("$csproj")
  fi
done < <(find "$REPO_ROOT/viewmodel-shell-dotnet" -name '*.csproj' -type f)

[ ${#COMPANIONS[@]} -eq 0 ] && { echo "no companion csproj discovered — nothing to check"; exit 0; }

echo "== Pack ${#COMPANIONS[@]} companion(s) =="
for csproj in "${COMPANIONS[@]}"; do
  echo "  - $(basename "$csproj")"
  dotnet pack -c Release "$csproj" -o "$FEED" --nologo -v q > "$TMP/pack-$(basename "$csproj").log" 2>&1 || {
    echo "companion pack failed for $csproj:"; cat "$TMP/pack-$(basename "$csproj").log"; exit 1;
  }
done

# Extract core version + Markdown version from their packed nupkgs so the
# consumer csproj pins the exact versions we just built (not whatever floor
# their nuspec would allow — this gate must exercise THIS tree's IL).
CORE_VER="$(ls "$FEED"/AshleyShrok.ViewModelShell.*.nupkg | grep -v Markdown | sed -E 's|.*/AshleyShrok\.ViewModelShell\.([0-9][^/]*)\.nupkg$|\1|' | sort -V | tail -1)"
[ -z "$CORE_VER" ] && { echo "could not derive core version from packed feed"; exit 1; }
echo "== Core packed as $CORE_VER =="

# Set up a throwaway consumer project that consumes ONLY the packed feed
# (no nuget.org fallback) — otherwise a stale registry version could satisfy
# the resolve and hide the bug this gate exists to catch.
CONSUMER="$TMP/Consumer"
mkdir -p "$CONSUMER"

cat > "$TMP/NuGet.Config" <<EOF
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <packageSources>
    <clear />
    <add key="local-feed" value="$FEED" />
    <add key="nuget-org" value="https://api.nuget.org/v3/index.json" />
  </packageSources>
  <packageSourceMapping>
    <!-- The two packages we're testing MUST resolve from the local feed. Their
         deps (Markdig, netstandard) come from nuget.org — restore fails cleanly
         if you drop this and something drifts. -->
    <packageSource key="local-feed">
      <package pattern="AshleyShrok.ViewModelShell*" />
    </packageSource>
    <packageSource key="nuget-org">
      <package pattern="*" />
    </packageSource>
  </packageSourceMapping>
</configuration>
EOF
cp "$TMP/NuGet.Config" "$CONSUMER/NuGet.Config"

cat > "$CONSUMER/Consumer.csproj" <<EOF
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <!-- Runtime matches the fleet's installed net9.0. Markdown itself targets
         net8.0 (nuspec floor); net9.0 is downward-compatible. -->
    <TargetFramework>net9.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <LangVersion>latest</LangVersion>
    <!-- Explicitly refuse to consume the local ProjectReference — this gate
         must exercise the PACKED IL, not a source rebuild. -->
    <DisableImplicitFrameworkReferences>false</DisableImplicitFrameworkReferences>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="AshleyShrok.ViewModelShell" Version="$CORE_VER" />
    <PackageReference Include="AshleyShrok.ViewModelShell.Markdown" Version="0.2.1" />
  </ItemGroup>
</Project>
EOF

# The consumer: feed a markdown string that exercises EVERY node the Markdown
# converter constructs, then require the returned tree contains one of each.
# If any ctor path is binary-broken under this core, ToViewNodes throws
# MissingMethodException here.
cat > "$CONSUMER/Program.cs" <<'EOF'
using System;
using System.Linq;
using ViewModelShell;
using ViewModelShell.Markdown;

var md = @"# Heading

A paragraph with **bold**, *italic*, ~~strike~~, `code`, and [a link](https://example.com).

- unordered item one
- unordered item two

1. ordered item one
2. ordered item two

- [ ] task not done
- [x] task done

> A blockquote line.

```csharp
var x = 1;
```

![alt text](https://example.com/img.png)

---
";

int failures = 0;
IReadOnlyList<ViewNode> nodes;
try {
    nodes = MarkdownConverter.ToViewNodes(md, new MarkdownOptions());
} catch (MissingMethodException ex) {
    Console.Error.WriteLine($"FAIL: MissingMethodException during ToViewNodes — companion IL references a ctor the packed core does not offer:");
    Console.Error.WriteLine($"  {ex.Message}");
    return 1;
} catch (Exception ex) {
    Console.Error.WriteLine($"FAIL: unexpected exception during ToViewNodes: {ex.GetType().Name}: {ex.Message}");
    return 1;
}

// Walk the tree collecting node type names. If ANY expected shape is absent
// the fixture markdown drifted or a converter branch silently dropped output.
var seen = new HashSet<string>();
void Walk(ViewNode n) {
    seen.Add(n.GetType().Name);
    switch (n) {
        case SectionNode s: foreach (var c in s.Children) Walk(c); break;
        case ListNode l: foreach (var c in l.Children) Walk(c); break;
        case ListItemNode li: foreach (var c in li.Children) Walk(c); break;
        case BlockquoteNode bq: foreach (var c in bq.Children) Walk(c); break;
    }
}
foreach (var n in nodes) Walk(n);

string[] required = {
    "TextNode",
    "ListNode",
    "ListItemNode",
    "BlockquoteNode",
    "CodeBlockNode",
    "ImageNode",
    "DividerNode",
};
foreach (var name in required) {
    if (!seen.Contains(name)) {
        Console.Error.WriteLine($"FAIL: fixture markdown produced no {name} — coverage gap.");
        failures++;
    }
}

Console.WriteLine($"companion-binary-compat: OK — {seen.Count} distinct node types constructed, all required ctors resolved.");
return failures;
EOF

echo "== Restore + run consumer =="
(cd "$CONSUMER" && dotnet run -c Release --nologo -v q 2>&1) | tee "$TMP/consumer.log"
STATUS=${PIPESTATUS[0]}
exit "$STATUS"
