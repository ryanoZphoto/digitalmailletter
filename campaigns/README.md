# Target Audience Upload

Use these files to assemble your campaign recipient list. Upload the CSV to the platform where prompted: "Upload Target Audience".

## Files
- target_audience_template.csv — schema with required columns and common merge variables
- target_audience_sample.csv — sample rows showing ideal-fit segments

## Columns (required unless noted)
- company_name
- contact_name
- address_line1
- address_line2 (optional)
- address_city
- address_state
- address_zip
- address_country (ISO-2, e.g., US)
- email (optional if mailing-only)
- phone (optional)
- industry (optional but useful)
- segment (e.g., SMB_Legal, SMB_Healthcare, B2B_SaaS, Gov_Local)
- merge_subject (optional) — personalize letter subject
- merge_reference (optional) — PO/Case/Acct reference
- merge_offer (optional) — simple promo or benefit line

## Suggested ICP (ideal customer profile)
- SMB legal services (law firms, process servers) — time-sensitive certified mail, notices
- Healthcare clinics & dental offices — billing statements, reminders
- Property management & HOAs — notices, rent reminders
- Accounting/bookkeeping — invoicing, statements
- B2B SaaS with compliance needs — formal notices, collections
- Local government & schools — official mailings, announcements

## Sourcing guidance (ethical, web-first)
1. Start with your CRM/clients. Export recent customers and lookalikes.
2. Chamber of Commerce/industry directories (state bar, medical/dental assoc, property mgmt associations). Export or copy public business listings.
3. Company sites and Google Business Profiles. Collect mailing addresses and main contact when public.
4. Use LinkedIn for decision-maker names/titles. Verify on the company site.
5. Validate addresses with USPS ZIP Code Lookup or Lob Address Verification.

## Data quality checklist
- Proper casing for names and addresses
- Address line1 includes suite/ste if applicable
- City/State/ZIP match USPS
- Country ISO-2 (US/CA/GB/AU supported by app)
- Remove duplicates; one row per recipient

## Privacy & compliance
- Use only publicly available or consented data.
- Provide opt-out instructions in your letter when appropriate.
