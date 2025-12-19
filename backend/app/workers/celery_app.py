"""
Celery application configuration
"""
from celery import Celery
from app.core.config import settings

# Initialize Celery
celery_app = Celery(
    "sigment",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=["app.workers.tasks", "app.workers.social_feed_tasks"]
)

from celery.schedules import crontab

# Celery Beat Schedule
celery_app.conf.beat_schedule = {
    "publish-scheduled-posts-every-minute": {
        "task": "publish_scheduled_posts",
        "schedule": crontab(minute="*"),  # Run every minute
    },
}

# Celery configuration
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=300,  # 5 minutes
    task_soft_time_limit=240,  # 4 minutes
    
    # HARDENING FOR HIGH CONCURRENCY
    task_acks_late=True,  # Ensure tasks are only acknowledged after successful execution
    worker_prefetch_multiplier=1,  # Prevent worker from hoarding tasks (better load balancing)
    task_reject_on_worker_lost=True,  # Re-queue task if worker crashes
    broker_pool_limit=10,  # Limit broker connections
    
    # Redis specific settings
    broker_transport_options={
        'visibility_timeout': 3600,  # 1 hour
        'max_connections': 20, # Limit Redis connections
    },
    
    # Dead Letter Queue Strategy (Routing failed tasks)
    task_routes={
        # Route logic could be expanded here
        '*': {'queue': 'default'},
    }
)

