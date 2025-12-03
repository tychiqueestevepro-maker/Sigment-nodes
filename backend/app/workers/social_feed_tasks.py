"""
Celery tasks for Social Feed - Virality Score Calculation
Optimized with "Cold Start" Boost for new posts
"""
from typing import Dict, Optional
from datetime import datetime, timedelta
from loguru import logger

from app.workers.celery_app import celery_app
from app.services.supabase_client import supabase


# ============================================
# CONSTANTS - Algorithme de Score
# ============================================

# Poids par type d'engagement
WEIGHT_LIKE = 1
WEIGHT_COMMENT = 3
WEIGHT_SHARE = 5
WEIGHT_SAVE = 10

# Boost de nouveauté (Cold Start)
BOOST_NEWNESS = 50  # Équivalent à 1 Save (50 points)
NEWNESS_THRESHOLD_HOURS = 2  # Boost actif si post < 2h

# Multiplicateurs de viralité
MULTIPLIER_LOCAL = 1.0
MULTIPLIER_TRENDING = 1.5  # Score > 100
MULTIPLIER_VIRAL = 2.0     # Score > 500
MULTIPLIER_NATIONAL = 3.0  # Score > 2000
MULTIPLIER_GLOBAL = 5.0    # Score > 10000

# Seuils pour déterminer le niveau de viralité
THRESHOLD_TRENDING = 100
THRESHOLD_VIRAL = 500
THRESHOLD_NATIONAL = 2000
THRESHOLD_GLOBAL = 10000

# Time Decay Optimization (Stop the Math)
TIME_DECAY_THRESHOLD_DAYS = 7  # Posts > 7 jours: pas de recalcul automatique
NECROMANCY_THRESHOLD_HOURS = 24  # Exception: Si interaction < 24h sur vieux post


# ============================================
# TASK 1: Calculate Virality Score (avec Cold Start)
# ============================================

@celery_app.task(name="calculate_virality_score", bind=True)
def calculate_virality_score_task(self, post_id: str):
    """
    Calcule le score de viralité d'un post avec l'algorithme optimisé "Cold Start"
    
    Formule complète :
    virality_score = (Engagement_Score + BOOST_NEWNESS) * Multiplier
    
    Où :
    - Engagement_Score = (likes * 1) + (comments * 3) + (shares * 5) + (saves * 10)
    - BOOST_NEWNESS = 50 points SI hours_old < 2, sinon 0
    - Multiplier = Basé sur le score (local, trending, viral, national, global)
    """
    try:
        logger.info(f"📊 Calculating virality score for post: {post_id}")
        
        # ============================================
        # STEP 1: Fetch Post Data
        # ============================================
        post_response = supabase.table("posts").select("*").eq("id", post_id).single().execute()
        
        if not post_response.data:
            raise ValueError(f"Post {post_id} not found")
        
        post = post_response.data
        
        # ============================================
        # STEP 2: Calculate Age (in hours)
        # ============================================
        created_at = datetime.fromisoformat(post["created_at"].replace("Z", "+00:00"))
        now = datetime.now(created_at.tzinfo)
        age_hours = (now - created_at).total_seconds() / 3600.0
        age_days = age_hours / 24.0
        
        # ============================================
        # STEP 2.5: Time Decay Optimization (Early Exit)
        # ============================================
        # "Stop the Math" : Posts > 7 jours ne sont plus recalculés
        # Exception "Necromancy Effect" : Si interaction récente (< 24h)
        
        if age_days > TIME_DECAY_THRESHOLD_DAYS:
            # Check for recent engagement (Necromancy Effect)
            last_engagement_str = post.get("last_engagement_at")
            
            if last_engagement_str:
                last_engagement_at = datetime.fromisoformat(last_engagement_str.replace("Z", "+00:00"))
                hours_since_last_engagement = (now - last_engagement_at).total_seconds() / 3600.0
                
                if hours_since_last_engagement > NECROMANCY_THRESHOLD_HOURS:
                    # Post trop vieux ET pas d'interaction récente → Early Exit
                    logger.info(
                        f"⏭️ Skipping calculation for old post {post_id} "
                        f"(age: {age_days:.1f} days, last engagement: "
                        f"{hours_since_last_engagement:.1f}h ago)"
                    )
                    return {
                        "status": "skipped",
                        "reason": "time_decay",
                        "post_id": post_id,
                        "age_days": age_days,
                        "message": "Post too old and no recent engagement"
                    }
                else:
                    # Necromancy Effect! Post vieux mais interaction récente
                    logger.info(
                        f"🧟 Necromancy Effect! Recalculating old post {post_id} "
                        f"(age: {age_days:.1f} days, last engagement: "
                        f"{hours_since_last_engagement:.1f}h ago)"
                    )
            else:
                # Pas de last_engagement_at → Pas d'interaction récente → Early Exit
                logger.info(
                    f"⏭️ Skipping calculation for old post {post_id} "
                    f"(age: {age_days:.1f} days, no recent engagement)"
                )
                return {
                    "status": "skipped",
                    "reason": "time_decay",
                    "post_id": post_id,
                    "age_days": age_days,
                    "message": "Post too old and no recent engagement"
                }
        
        # ============================================
        # STEP 3: Calculate Base Engagement Score
        # ============================================
        likes = post.get("likes_count", 0)
        comments = post.get("comments_count", 0)
        shares = post.get("shares_count", 0)
        saves = post.get("saves_count", 0)
        
        engagement_score = (
            (likes * WEIGHT_LIKE) +
            (comments * WEIGHT_COMMENT) +
            (shares * WEIGHT_SHARE) +
            (saves * WEIGHT_SAVE)
        )
        
        # ============================================
        # STEP 4: Apply "Cold Start" Boost
        # ============================================
        boost_newness = 0
        if age_hours < NEWNESS_THRESHOLD_HOURS:
            boost_newness = BOOST_NEWNESS
            logger.info(f"🚀 Cold Start Boost applied: +{BOOST_NEWNESS} points (age: {age_hours:.2f}h)")
        
        # Score avec boost
        score_with_boost = engagement_score + boost_newness
        
        # ============================================
        # STEP 5: Determine Virality Level & Multiplier
        # ============================================
        if score_with_boost >= THRESHOLD_GLOBAL:
            virality_level = "global"
            multiplier = MULTIPLIER_GLOBAL
        elif score_with_boost >= THRESHOLD_NATIONAL:
            virality_level = "national"
            multiplier = MULTIPLIER_NATIONAL
        elif score_with_boost >= THRESHOLD_VIRAL:
            virality_level = "viral"
            multiplier = MULTIPLIER_VIRAL
        elif score_with_boost >= THRESHOLD_TRENDING:
            virality_level = "trending"
            multiplier = MULTIPLIER_TRENDING
        else:
            virality_level = "local"
            multiplier = MULTIPLIER_LOCAL
        
        # ============================================
        # STEP 6: Calculate Final Virality Score
        # ============================================
        virality_score = score_with_boost * multiplier
        
        logger.info(
            f"📈 Post {post_id}: "
            f"Engagement={engagement_score}, "
            f"Boost={boost_newness}, "
            f"Multiplier={multiplier}x, "
            f"Final Score={virality_score:.2f}, "
            f"Level={virality_level}"
        )
        
        # ============================================
        # STEP 7: Update Post
        # ============================================
        supabase.table("posts").update({
            "virality_score": virality_score,
            "virality_level": virality_level,
            "updated_at": "now()"
        }).eq("id", post_id).execute()
        
        # ============================================
        # STEP 8: Update Tag Trend Scores (si applicable)
        # ============================================
        update_tag_trend_scores_task.delay(post_id)
        
        logger.info(f"✅ Virality score updated for post {post_id}")
        
        return {
            "status": "success",
            "post_id": post_id,
            "virality_score": virality_score,
            "virality_level": virality_level,
            "age_hours": age_hours,
            "boost_applied": boost_newness > 0
        }
        
    except Exception as e:
        logger.error(f"❌ Error calculating virality score for post {post_id}: {e}")
        raise self.retry(exc=e, countdown=2 ** self.request.retries, max_retries=3)


# ============================================
# TASK 2: Update Tag Trend Scores
# ============================================

@celery_app.task(name="update_tag_trend_scores")
def update_tag_trend_scores_task(post_id: str):
    """
    Met à jour le trend_score des tags associés à un post
    
    Trend Score = Moyenne des virality_scores des posts avec ce tag
    """
    try:
        logger.info(f"🏷️ Updating tag trend scores for post: {post_id}")
        
        # ============================================
        # STEP 1: Get Post Tags
        # ============================================
        post_tags_response = supabase.table("post_tags").select(
            "tag_id, tags(id, name, organization_id)"
        ).eq("post_id", post_id).execute()
        
        if not post_tags_response.data or len(post_tags_response.data) == 0:
            logger.info(f"No tags found for post {post_id}")
            return
        
        # ============================================
        # STEP 2: Calculate Trend Score for Each Tag
        # ============================================
        for pt in post_tags_response.data:
            tag = pt["tags"]
            tag_id = tag["id"]
            
            # Get all posts with this tag
            tagged_posts_response = supabase.table("post_tags").select(
                "posts!inner(virality_score)"
            ).eq("tag_id", tag_id).execute()
            
            if not tagged_posts_response.data:
                continue
            
            # Calculate average virality score
            virality_scores = [p["posts"]["virality_score"] for p in tagged_posts_response.data if p["posts"]["virality_score"] is not None]
            
            if len(virality_scores) > 0:
                trend_score = sum(virality_scores) / len(virality_scores)
            else:
                trend_score = 0
            
            # Update tag
            supabase.table("tags").update({
                "trend_score": trend_score,
                "updated_at": "now()"
            }).eq("id", tag_id).execute()
            
            logger.info(f"Updated tag '{tag['name']}' trend score: {trend_score:.2f}")
        
        logger.info(f"✅ Tag trend scores updated for post {post_id}")
        
        return {"status": "success", "post_id": post_id}
        
    except Exception as e:
        logger.error(f"❌ Error updating tag trend scores for post {post_id}: {e}")
        raise


# ============================================
# TASK 3: Recalculate All Virality Scores (Batch)
# ============================================

@celery_app.task(name="recalculate_all_virality_scores")
def recalculate_all_virality_scores_task(organization_id: Optional[str] = None):
    """
    Recalcule tous les scores de viralité (pour maintenance)
    Optionnel: Filtrer par organization_id
    """
    try:
        logger.info(f"🔄 Recalculating all virality scores (org: {organization_id or 'ALL'})")
        
        # Build query
        query = supabase.table("posts").select("id")
        
        if organization_id:
            query = query.eq("organization_id", organization_id)
        
        posts_response = query.execute()
        
        if not posts_response.data:
            logger.warning("No posts found")
            return {"status": "success", "count": 0}
        
        # Queue calculation tasks
        count = 0
        for post in posts_response.data:
            calculate_virality_score_task.delay(post["id"])
            count += 1
        
        logger.info(f"✅ Queued {count} virality score calculations")
        
        return {"status": "success", "count": count}
        
    except Exception as e:
        logger.error(f"❌ Error recalculating virality scores: {e}")
        raise


# ============================================
# TASK 4: Auto-recalculate on Engagement
# ============================================

def trigger_virality_recalculation(post_id: str):
    """
    Helper function appelée quand un post reçoit un engagement (like, comment, etc.)
    À appeler depuis les endpoints d'engagement
    """
    calculate_virality_score_task.delay(post_id)
    logger.info(f"🔔 Virality recalculation triggered for post {post_id}")
