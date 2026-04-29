# -*- coding: utf-8 -*-
"""
ai/openrouter_client.py
Modern Wrapper for the OpenRouter API.
"""
import os
import json
import urllib.request
import urllib.error

class AIError(Exception):
    """Custom exception for AI API failures."""
    pass

class OpenRouterClient:
    def __init__(self):
        # Fallback to your hardcoded key if the .env variable isn't set
        self.api_key = "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"
        self.url = "https://openrouter.ai/api/v1/chat/completions"
        # Mistral 7B Free is generally the most stable free model on OpenRouter
        self.model = "openrouter/auto"

    def chat(self, messages: list, max_tokens: int = 600, temperature: float = 0.7) -> str:
        if not self.api_key:
            raise AIError("OPENROUTER_API_KEY manquante.")

        payload = json.dumps({
            "model": self.model,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "messages": messages,
        }).encode("utf-8")

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "Neo-Sousse 2030",
        }

        req = urllib.request.Request(self.url, data=payload, headers=headers, method="POST")

        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                
                # Check if OpenRouter returned a graceful error inside the JSON
                if "error" in data:
                    err_msg = data["error"].get("message", str(data["error"]))
                    raise AIError(err_msg)
                    
                return data["choices"][0]["message"]["content"].strip()
                
        except urllib.error.HTTPError as e:
            # If OpenRouter returns a 4xx or 5xx error, parse it cleanly
            try:
                err_data = json.loads(e.read().decode("utf-8"))
                err_msg = err_data.get("error", {}).get("message", str(err_data))
            except Exception:
                err_msg = e.reason
            raise AIError(f"HTTP {e.code}: {err_msg}")
            
        except urllib.error.URLError as e:
            raise AIError(f"Erreur réseau: {e.reason}")
            
        except (KeyError, IndexError):
            # If we STILL get a weird format, print exactly what OpenRouter sent us
            raise AIError(f"Format inattendu reçu: {json.dumps(data)}")

# Global instance for easy importing
ai_client = OpenRouterClient()