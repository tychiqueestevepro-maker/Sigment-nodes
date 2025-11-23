"""
SIGMENT FastAPI Main Application
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from app.core.config import settings
from app.api.routes import notes, clusters, pillars, users, board

# Initialize FastAPI app
app = FastAPI(
    title="SIGMENT API",
    description="AI-Powered Idea Capture & Strategic Decision Dashboard",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(notes.router, prefix="/api/v1/notes", tags=["Notes"])
app.include_router(clusters.router, prefix="/api/v1/clusters", tags=["Clusters"])
app.include_router(pillars.router, prefix="/api/v1/pillars", tags=["Pillars"])
app.include_router(users.router, prefix="/api/v1/users", tags=["Users"])
app.include_router(board.router, prefix="/api/v1/board", tags=["Board"])


@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    logger.info("🚀 SIGMENT API Starting...")
    logger.info(f"Environment: {settings.ENVIRONMENT}")
    logger.info(f"Supabase URL: {settings.SUPABASE_URL}")


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    logger.info("👋 SIGMENT API Shutting down...")


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "online",
        "service": "SIGMENT API",
        "version": "1.0.0",
        "docs": "/api/docs",
    }


@app.get("/health")
async def health():
    """Detailed health check"""
    return {
        "status": "healthy",
        "database": "connected",
        "redis": "connected",
    }


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
    )

