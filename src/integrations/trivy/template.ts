/**
 * A GitHub Actions security workflow that scans the repository with Trivy.
 * Trivy is a standalone binary (there is no npm package to install), so CI is
 * its natural home — this is the one Integration that ships a `.github/workflows`
 * file into a target rather than a devDependency + script.
 *
 * It runs on every pull request and weekly (03:00 UTC Monday) so a
 * newly-disclosed CVE in an otherwise-unchanged dependency still surfaces. A
 * first step reports every severity without failing the job; a second step
 * fails on HIGH/CRITICAL. Tool-owned: overwritten on each harness run.
 *
 * The YAML is static (no per-target interpolation), so it lives as a
 * module-level constant and `securityWorkflow()` is a thin accessor — the same
 * const-body-plus-accessor split husky uses for its hook scripts.
 */
const SECURITY_WORKFLOW = `name: Security

# Trivy scans dependencies, config/IaC, and secrets for known vulnerabilities.
# Kept off the push path so the inner loop stays fast; the weekly schedule
# surfaces newly-disclosed CVEs even when nobody pushes.
on:
  pull_request:
  schedule:
    - cron: '0 3 * * 1' # 03:00 UTC every Monday

# Least privilege: the scan only reads the tree.
permissions:
  contents: read

concurrency:
  group: \${{ github.workflow }}-\${{ github.ref }}
  cancel-in-progress: true

jobs:
  trivy:
    name: trivy
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - name: Trivy report (all severities — warn only)
        uses: aquasecurity/trivy-action@v0.36.0
        env:
          TRIVY_INCLUDE_DEV_DEPS: 'true'
        with:
          scan-type: fs
          scan-ref: .
          scanners: vuln,secret,misconfig
          severity: UNKNOWN,LOW,MEDIUM,HIGH,CRITICAL
          # Report everything for visibility, but never block on it.
          exit-code: '0'
      - name: Trivy gate (HIGH / CRITICAL — fail)
        uses: aquasecurity/trivy-action@v0.36.0
        env:
          TRIVY_INCLUDE_DEV_DEPS: 'true'
        with:
          scan-type: fs
          scan-ref: .
          scanners: vuln,secret,misconfig
          severity: HIGH,CRITICAL
          # Block the merge / release only on real risk.
          exit-code: '1'
`;

export function securityWorkflow(): string {
  return SECURITY_WORKFLOW;
}
