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
        - Assigned pillar
        - Relevance score (1-10)
        """
        pillars_list = "\n".join([f"- {p['name']}: {p['description']}" for p in available_pillars])
        
        system_prompt = f"""You are a Strategic Analyst for a B2B company.

AUTHOR CONTEXT:
- Job Title: {user_context.job_title}
- Department: {user_context.department}
- Seniority Level: {user_context.seniority_level}/5

AVAILABLE PILLARS:
{pillars_list}

YOUR TASK:
1. Rewrite the note for clarity and executive comprehension (keep it concise)
2. Assign the most appropriate Pillar
3. Calculate a Relevance Score (1-10) based on:
   - HIGH SCORE (8-10): Topic matches author's expertise domain
   - MEDIUM SCORE (5-7): Topic is adjacent to author's domain
   - LOW SCORE (1-4): Topic is outside author's expertise

RESPONSE FORMAT (JSON):
{{
  "clarified_content": "Clear, executive-friendly version",
  "pillar_name": "The pillar name exactly as listed",
  "relevance_score": 8.5,
  "reasoning": "Brief explanation of score"
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


# Global instance
ai_service = AIService()

