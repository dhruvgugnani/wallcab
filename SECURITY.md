# Security policy

## Supported version

Only the current `main` branch and production deployment receive security fixes during the MVP.

## Reporting a vulnerability

Do not open a public issue for a vulnerability. Use GitHub’s private vulnerability reporting for this repository. Include the affected route or component, reproduction steps, impact, and any suggested mitigation. Remove real service secrets, signed URLs, IP addresses, and private Worker identifiers from evidence.

You should receive an acknowledgement within seven days. Please allow time for validation and coordinated remediation before disclosure.

## Security boundaries

WallCab treats provider data, query strings, remote media, cache values, and signatures as untrusted. It does not accept user uploads or store profiles. Service and signing secrets must be independent and must never use the `NEXT_PUBLIC_` prefix.
