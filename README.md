# NexDiff-backend

## Career application email

The `/api/careers` endpoint saves the application first, then sends email with Nodemailer when SMTP is configured.

The admin `/api/admin/submissions/:id/status` endpoint sends a customer email when a contact, application, or plan request status changes.

Required SMTP variables:

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
MAIL_FROM="NexDiff Careers <careers@nexdiff.com>"
SEND_INTERNAL_NOTIFY_EMAILS=false
CAREERS_NOTIFY_EMAIL=hr@nexdiff.com
PLAN_REQUEST_NOTIFY_EMAIL=sales@nexdiff.com
```

When `SEND_INTERNAL_NOTIFY_EMAILS=false`, NexDiff only sends confirmation emails to applicants/customers and skips internal notification emails.

If `SEND_INTERNAL_NOTIFY_EMAILS` is enabled, `CAREERS_NOTIFY_EMAIL` receives the new application notification with the uploaded resume attached.

If `SEND_INTERNAL_NOTIFY_EMAILS` is enabled, `PLAN_REQUEST_NOTIFY_EMAIL` receives new plan request notifications. If it is not set, plan request notifications fall back to `MAIL_TO`, then `CAREERS_NOTIFY_EMAIL`, then the sending account.

Admin status update emails are customer-facing only. They are sent to the email address submitted with the contact, career, or plan request.
