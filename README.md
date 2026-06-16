# NexDiff-backend

## Career application email

The `/api/careers` endpoint saves the application first, then sends email with Nodemailer when SMTP is configured.

Required SMTP variables:

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
MAIL_FROM="NexDiff Careers <careers@nexdiff.com>"
CAREERS_NOTIFY_EMAIL=hr@nexdiff.com
```

`CAREERS_NOTIFY_EMAIL` receives the new application notification with the uploaded resume attached. If the applicant enters an email address, they also receive a confirmation email.
