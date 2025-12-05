"""
AI Service: OpenAI integration for analysis and embeddings
"""
import json
from typing import Dict, List, Optional, Tuple
from openai import OpenAI
from loguru import logger

from app.core.config import settings
from app.models.note import UserContext


class AIService:
    """OpenAI-powered AI analysis service"""
    
    def __init__(self):
        self.client = OpenAI(api_key=settings.OPENAI_API_KEY)
        self.model = settings.OPENAI_MODEL
        self.embedding_model = settings.OPENAI_EMBEDDING_MODEL
    
    def analyze_note(
        self,
        content: str,
        user_context: UserContext,
        available_pillars: List[Dict]
    ) -> Dict:
        """
        Analyze note and return:
        - Clarified content
        - Assigned pillar (from existing pillars ONLY)
        - Relevance score (1-10)
        
        STRICT CONSTRAINT: Never create new pillars, only assign to existing ones
        """
        # Format pillars with ID for strict matching
        pillars_list = "\n".join([
            f"- ID: {p['id']} | Name: {p['name']} | Description: {p['description']}" 
            for p in available_pillars
        ])
        
        system_prompt = f"""You are a DEMANDING Strategic Analyst for a B2B company.
BE SEVERE AND CRITICAL. This is a professional environment - high scores are RARE.

AUTHOR CONTEXT:
- Job Title: {user_context.job_title}
- Department: {user_context.department}
- Seniority Level: {user_context.seniority_level}/5

AVAILABLE PILLARS (FIXED LIST - YOU CANNOT CREATE NEW ONES):
{pillars_list}

🔒 CRITICAL CONSTRAINT:
You MUST assign the note to ONE of the pillars listed above. 
You are FORBIDDEN from inventing or suggesting new pillars.
If the note doesn't fit well in any pillar, choose the one with the highest relevance and give it a low score.

YOUR TASK:
1. Create a SHORT TITLE (max 10 words) that captures the core idea
2. Rewrite the note for clarity and executive comprehension (keep it concise)
3. Assign to the EXISTING pillar with the HIGHEST relevance score
4. Calculate a Relevance Score (1-10) with SEVERE PROFESSIONAL CRITERIA:

⚠️ STRICT SCORING GUIDELINES (BE DEMANDING):
   - EXCEPTIONAL (8.5-10): RARE. Clear ROI, strong strategic alignment, actionable, from relevant expert
   - GOOD (6.5-8.4): Solid idea with potential, needs refinement, partially actionable
   - ACCEPTABLE (5-6.4): Vague, unclear implementation path, or weak strategic fit
   - WEAK (3-4.9): Poor fit, unclear value, lacks specificity
   - REJECT (1-2.9): Off-topic, not actionable, or irrelevant to business objectives
   
   🚫 DO NOT give 8+ unless the idea is TRULY exceptional and clearly actionable
   🚫 Most average ideas should score between 4-6
   🚫 Author's seniority does NOT automatically mean high score
   
   ⚠️ SPECIAL RULE: If ALL pillars score < 5/10, return pillar_id as null and pillar_name as "Uncategorized"

RESPONSE FORMAT (JSON):
{{
  "clarified_title": "Short, specific title (max 10 words)",
  "clarified_content": "Clear, executive-friendly version of the idea",
  "pillar_id": "The exact UUID from the list above (or null if score < 5)",
  "pillar_name": "The exact pillar name from the list above (or 'Uncategorized' if score < 5)",
  "relevance_score": 6.5,
  "reasoning": "Why this score? Be honest about weaknesses."
}}
"""
        
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": content}
                ],
                response_format={"type": "json_object"},
                temperature=0.3,
            )
            
            result = json.loads(response.choices[0].message.content)
            
            # Validation: Ensure pillar_id matches an existing pillar
            if result.get("pillar_id") and result["pillar_id"] != "null":
                pillar_exists = any(p["id"] == result["pillar_id"] for p in available_pillars)
                if not pillar_exists:
                    logger.warning(f"AI returned invalid pillar_id: {result['pillar_id']}, falling back to name matching")
                    # Fallback: find by name
                    pillar = next((p for p in available_pillars if p["name"] == result["pillar_name"]), None)
                    if pillar:
                        result["pillar_id"] = pillar["id"]
                    else:
                        result["pillar_id"] = None
                        result["pillar_name"] = "Uncategorized"
            
            logger.info(f"AI Analysis: Pillar={result['pillar_name']}, Score={result['relevance_score']}")
            
            return result
            
        except Exception as e:
            logger.error(f"AI Analysis failed: {e}")
            raise
    
    def generate_embedding(self, text: str) -> List[float]:
        """Generate text embedding using OpenAI"""
        try:
            response = self.client.embeddings.create(
                model=self.embedding_model,
                input=text,
                encoding_format="float"
            )
            
            embedding = response.data[0].embedding
            logger.info(f"Generated embedding: {len(embedding)} dimensions")
            
            return embedding
            
        except Exception as e:
            logger.error(f"Embedding generation failed: {e}")
            raise
    
    def generate_cluster_synthesis(
        self,
        notes: List[Dict],
        cluster_title: str,
        pillar_name: str
    ) -> str:
        """
        Generate executive synthesis for a cluster of notes
        """
        notes_text = "\n\n".join([
            f"[{note['user_department']} | {note['user_job_title']} | Score: {note['ai_relevance_score']}/10]\n{note['content_clarified']}"
            for note in notes
        ])
        
        system_prompt = f"""You are a Strategic Synthesizer for the Board of Directors.

CLUSTER CONTEXT:
- Pillar: {pillar_name}
- Topic: {cluster_title}
- Number of Ideas: {len(notes)}

YOUR TASK:
Write a concise executive synthesis (max 200 words) that:
1. Identifies the core issue/opportunity
2. Highlights key insights from high-scoring contributors
3. Suggests strategic implications
4. Maintains neutrality and objectivity

Be data-driven and actionable.
"""
        
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"EMPLOYEE IDEAS:\n\n{notes_text}"}
                ],
                temperature=0.5,
                max_tokens=400,
            )
            
            synthesis = response.choices[0].message.content
            logger.info(f"Generated synthesis: {len(synthesis)} chars")
            
            return synthesis
            
        except Exception as e:
            logger.error(f"Synthesis generation failed: {e}")
            raise
    
    def generate_cluster_title(self, notes: List[Dict]) -> str:
        """
        Generate a concise title for a cluster based on common themes
        """
        notes_text = "\n".join([note['content_clarified'][:200] for note in notes[:10]])
        
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": "Generate a concise, specific title (max 8 words) that captures the common theme of these ideas. Be specific, not generic."
                    },
                    {"role": "user", "content": notes_text}
                ],
                temperature=0.3,
                max_tokens=20,
            )
            
            title = response.choices[0].message.content.strip('"').strip("'")
            logger.info(f"Generated cluster title: {title}")
            
            return title
            
        except Exception as e:
            logger.error(f"Title generation failed: {e}")
            return "Untitled Cluster"
    
    def generate_strategic_brief(
        self,
        cluster_title: str,
        pillar_name: str,
        notes: List[Dict],
        avg_relevance: float
    ) -> str:
        """
        Generate a short strategic brief (150-200 characters max) for executive quick-view.
        
        SEVERE PROFESSIONAL ASSESSMENT: Honest, critical, no sugarcoating.
        """
        # Build context from notes
        notes_summary = "\n".join([
            f"- {note.get('content_clarified', note.get('content_raw', ''))[:100]}"
            for note in notes[:5]  # Use top 5 notes
        ])
        
        # Determine severity level based on score
        if avg_relevance >= 8.5:
            score_context = "HIGH PRIORITY - Exceptional strategic alignment"
        elif avg_relevance >= 6.5:
            score_context = "MODERATE PRIORITY - Good potential but needs refinement"
        else:
            score_context = "LOW PRIORITY - Weak alignment or unclear value proposition"
        
        system_prompt = f"""You are a DEMANDING Strategic Advisor for a board of directors.
Be SEVERE, CRITICAL, and PROFESSIONAL. No sugarcoating.

CLUSTER ASSESSMENT:
- Title: {cluster_title}
- Pillar: {pillar_name}
- Relevance Score: {avg_relevance:.1f}/10
- Assessment Level: {score_context}
- Number of Contributions: {len(notes)}

YOUR TASK:
Write a BRUTALLY HONEST strategic brief (MAXIMUM 200 characters).

TONE REQUIREMENTS:
1. Be CRITICAL - point out weaknesses honestly
2. Be SPECIFIC - avoid vague statements
3. Be ACTIONABLE - what decision is needed?
4. If score < 6.5 → Be skeptical and highlight concerns
5. If score 6.5-8.5 → Acknowledge potential but note gaps
6. If score > 8.5 → Confirm strategic value with urgency

NEVER use:
- "Interesting ideas" or similar weak language
- "Team suggests" or passive voice
- Overly positive spinning of weak ideas

EXAMPLE FOR LOW SCORE (45 chars):
"Unclear ROI. Needs clearer business case before consideration."

EXAMPLE FOR MEDIUM SCORE (120 chars):
"Valid customer pain points identified. Requires detailed feasibility study and cost-benefit analysis before pilot."

EXAMPLE FOR HIGH SCORE (90 chars):
"Strategic opportunity aligned with Q1 goals. Recommend fast-track evaluation by operations."

OUTPUT: Just the brief. Maximum 200 characters. Be demanding."""

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"EMPLOYEE IDEAS TO ASSESS:\n{notes_summary}"}
                ],
                temperature=0.3,  # Lower temperature for more consistent, serious tone
                max_tokens=80,
            )
            
            brief = response.choices[0].message.content.strip().strip('"').strip("'")
            
            # Ensure max length
            if len(brief) > 200:
                brief = brief[:197] + "..."
            
            logger.info(f"Generated strategic brief: {len(brief)} chars (score: {avg_relevance:.1f})")
            
            return brief
            
        except Exception as e:
            logger.error(f"Strategic brief generation failed: {e}")
            return "Assessment pending. Insufficient data for executive recommendation."


# Global instance
ai_service = AIService()

