# Google Cloud deployment

This project is prepared for Google Cloud Run. Cloud Run serves the website and Node API from one HTTPS URL.

1. Install the Google Cloud CLI and sign in:

```powershell
gcloud auth login
gcloud init
```

2. From this folder, set your Google Cloud project:

```powershell
gcloud config set project YOUR_PROJECT_ID
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
```

3. Deploy directly from source:

```powershell
gcloud run deploy shree-devi-collection --source . --region asia-south1 --allow-unauthenticated
```

4. In Cloud Run → Variables & secrets, set:

```text
PUBLIC_URL=https://YOUR_CLOUD_RUN_URL
ADMIN_TOKEN=your-private-dashboard-token
DATABASE_URL=your-postgresql-connection-string
```

`DATABASE_URL` should point to a managed PostgreSQL database such as Cloud SQL or Supabase. Without it, the app uses the local JSON fallback, which is not durable on Cloud Run.

The `Dockerfile` and `cloudbuild.yaml` are included for container-based deployment.
