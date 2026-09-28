from fastapi import FastAPI, APIRouter, Request, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import httpx
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List
import uuid
from datetime import datetime
from email_service import process_reminders, process_overdue_tasks, run_weekly_report

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Supabase config for triggering edge functions
SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_ANON_KEY = os.environ.get('SUPABASE_ANON_KEY', '')

# Create the main app without a prefix
app = FastAPI()

# Rate limiter — uses client IP as key. Limits apply per-IP per-time-window.
# Defaults can be tuned via env vars.
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[os.environ.get("RATE_LIMIT_DEFAULT", "120/minute")],
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Scheduler jobs
# ---------------------------------------------------------------------------

async def trigger_edge_function(function_name: str) -> None:
    """Call a Supabase Edge Function by name."""
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        logger.warning(f"Supabase not configured, skipping {function_name}")
        return

    url = f"{SUPABASE_URL}/functions/v1/{function_name}"
    headers = {
        "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as http_client:
            response = await http_client.post(url, headers=headers, json={})
            data = response.json()
            logger.info(f"[{function_name}] status={response.status_code} → {data}")
    except Exception as exc:
        logger.error(f"[{function_name}] Error: {exc}")


async def job_process_reminders():
    """Every 5 minutes — sends due reminders and recurring tasks via Python directly."""
    logger.info("⏰ Running: process_reminders")
    result = await process_reminders()
    logger.info(f"⏰ Done: reminders={result['reminders']}, recurring={result['recurring']}")


async def job_check_overdue_tasks():
    """Daily at 08:00 — notifies about overdue tasks via Python directly."""
    logger.info("📋 Running: process_overdue_tasks")
    result = await process_overdue_tasks()
    logger.info(f"📋 Done: notified={result['processed']}")


async def job_weekly_report():
    """Daily at 08:05 — sends weekly summary (checks configured day internally)."""
    logger.info("📈 Running: weekly_report")
    await run_weekly_report()


# Scheduler instance
scheduler = AsyncIOScheduler(timezone="Europe/Sofia")


# ---------------------------------------------------------------------------
# Startup / Shutdown
# ---------------------------------------------------------------------------

@app.on_event("startup")
async def startup_event():
    # Every 5 minutes: reminders
    scheduler.add_job(
        job_process_reminders,
        trigger=IntervalTrigger(minutes=5),
        id="process_reminders",
        replace_existing=True,
        next_run_time=datetime.now(),   # run immediately on start too
    )

    # Daily at 08:00 Sofia time: overdue tasks
    scheduler.add_job(
        job_check_overdue_tasks,
        trigger=CronTrigger(hour=8, minute=0),
        id="check_overdue_tasks",
        replace_existing=True,
    )

    # Daily at configured hour: weekly report (checks day internally)
    scheduler.add_job(
        job_weekly_report,
        trigger=CronTrigger(hour=8, minute=5),
        id="weekly_report",
        replace_existing=True,
    )

    scheduler.start()
    logger.info("✅ Scheduler started (reminders every 5 min, overdue tasks daily at 08:00)")


@app.on_event("shutdown")
async def shutdown_event():
    scheduler.shutdown(wait=False)
    client.close()


# ---------------------------------------------------------------------------
# API routes
# ---------------------------------------------------------------------------

class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class StatusCheckCreate(BaseModel):
    client_name: str


@api_router.get("/")
@limiter.limit("60/minute")
async def root(request: Request):
    return {"message": "Hello World"}


@api_router.get("/scheduler-status")
@limiter.limit("30/minute")
async def scheduler_status(request: Request):
    """Returns current scheduler jobs and their next run times."""
    jobs = []
    for job in scheduler.get_jobs():
        jobs.append({
            "id": job.id,
            "next_run": str(job.next_run_time) if job.next_run_time else None,
        })
    return {"running": scheduler.running, "jobs": jobs}


@api_router.post("/status", response_model=StatusCheck)
@limiter.limit("20/minute")
async def create_status_check(request: Request, input: StatusCheckCreate):
    status_dict = input.dict()
    status_obj = StatusCheck(**status_dict)
    _ = await db.status_checks.insert_one(status_obj.dict())
    return status_obj


@api_router.get("/status", response_model=List[StatusCheck])
@limiter.limit("60/minute")
async def get_status_checks(request: Request):
    status_checks = await db.status_checks.find().to_list(1000)
    return [StatusCheck(**status_check) for status_check in status_checks]


# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)
