# Security & Data Privacy Policy

## Data Handling Principles

Project Signal is built on a **public data only** principle. We are committed to responsible, ethical use of personal and company data.

### What We Collect
- **Company data**: Publicly available information from company websites, press releases, and professional networks
- **Personal signals**: Only information that decision-makers have **voluntarily and publicly posted** on professional platforms (e.g., LinkedIn public posts, public press releases, public announcements)

### What We Do NOT Collect
- Private messages or emails
- Data behind authentication walls
- Personal data not intentionally made public by the individual
- Health, financial, or other sensitive personal categories

---

## GDPR / CCPA Compliance

### Right to Erasure (Hard Delete)
If any individual requests deletion of their data, the following steps must be taken:

1. **Database purge**: Execute the `hard_delete_prospect()` SQL function in Supabase, which cascades DELETE across `companies`, `signals`, and `competitors` tables.
2. **Vector purge**: Call `qdrant_sync.delete_vectors_for_signal()` for each signal associated with the individual to remove their data from the RLHF training lake.
3. **Confirmation**: Log the erasure with timestamp and confirm to the requester within 30 days.

### Data Retention
- Signal data is retained as long as the company is `ACTIVE` in the system.
- Users can set a company to `DORMANT` to effectively cease active monitoring.
- Full erasure on request removes all associated data from both Supabase and Qdrant.

### Data Residency
- **Supabase**: Hosted on AWS (region selectable in Supabase project settings)
- **Qdrant Cloud**: Hosted on GCP (region selectable when creating the cluster)
- **Oracle VM**: VMs are in the region you select during OCI instance creation

---

## Responsible Disclosure

If you discover a security vulnerability in Project Signal, please **do not** open a public GitHub issue.

Instead, report it privately:
- Open a [GitHub Security Advisory](https://github.com/CapAmin22/Prospect_AI_Agent/security/advisories/new)

We will respond within **72 hours** and aim to release a fix within **14 days** of a confirmed vulnerability.

---

## SMTP Verification Ethics

The zero-cost email verification module (`src/enrichment/email_verifier.py`) simulates an SMTP handshake **without sending any email**. The following safeguards are enforced:

- Maximum **10 verifications per domain per hour** to prevent IP reputation damage
- Must run from **Oracle Cloud VM** (port 25 blocked on residential/serverless IPs)
- The fake sender email uses a clearly labeled domain — never impersonating a real user

---

## AI-Generated Content Safety

All AI-generated nurture drafts are:
1. **Architecturally HITL-gated** — cannot be dispatched without explicit human approval
2. **Prompted to avoid hard-selling** — the system instruction forbids product pitches
3. **Source-linked** — every signal used to generate a draft has a clickable source URL visible to the approving human

---

*Last updated: February 2026*
