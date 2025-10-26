#!/usr/bin/env python3
"""
Presidio PHI Detection Service
Detects Protected Health Information (PHI) in text using Microsoft Presidio
"""

import sys
import json
from typing import List, Dict, Any
from presidio_analyzer import AnalyzerEngine, RecognizerRegistry
from presidio_analyzer.nlp_engine import NlpEngineProvider
from presidio_anonymizer import AnonymizerEngine
from presidio_anonymizer.entities import OperatorConfig

class PHIDetectionService:
    def __init__(self):
        configuration = {
            "nlp_engine_name": "spacy",
            "models": [{"lang_code": "en", "model_name": "en_core_web_sm"}],
        }
        
        provider = NlpEngineProvider(nlp_configuration=configuration)
        nlp_engine = provider.create_engine()
        
        registry = RecognizerRegistry()
        registry.load_predefined_recognizers(nlp_engine=nlp_engine)
        
        self.analyzer = AnalyzerEngine(nlp_engine=nlp_engine, registry=registry)
        self.anonymizer = AnonymizerEngine()
        
        self.phi_entities = [
            "PERSON",
            "EMAIL_ADDRESS",
            "PHONE_NUMBER",
            "US_SSN",
            "US_DRIVER_LICENSE",
            "CREDIT_CARD",
            "IBAN_CODE",
            "IP_ADDRESS",
            "DATE_TIME",
            "LOCATION",
            "MEDICAL_LICENSE",
            "US_PASSPORT",
            "URL",
        ]
    
    def detect_phi(self, text: str, language: str = "en", threshold: float = 0.5) -> Dict[str, Any]:
        """
        Detect PHI in text and return detailed results
        
        Args:
            text: Text to analyze
            language: Language code (default: en)
            threshold: Minimum confidence threshold (0-1)
        
        Returns:
            Dictionary with detection results
        """
        if not text or not text.strip():
            return {
                "has_phi": False,
                "phi_count": 0,
                "entities": [],
                "risk_score": 0.0,
                "anonymized_text": text
            }
        
        results = self.analyzer.analyze(
            text=text,
            language=language,
            entities=self.phi_entities,
            score_threshold=threshold
        )
        
        entities_found = []
        risk_score = 0.0
        
        for result in results:
            entities_found.append({
                "type": result.entity_type,
                "start": result.start,
                "end": result.end,
                "score": result.score,
                "text": text[result.start:result.end]
            })
            
            risk_score = max(risk_score, result.score)
        
        anonymized_result = self.anonymizer.anonymize(
            text=text,
            analyzer_results=results,
            operators={"DEFAULT": OperatorConfig("replace", {"new_value": "<PHI>"})}
        )
        
        return {
            "has_phi": len(results) > 0,
            "phi_count": len(results),
            "entities": entities_found,
            "risk_score": risk_score,
            "anonymized_text": anonymized_result.text,
            "threshold_used": threshold
        }
    
    def batch_detect(self, texts: List[str], language: str = "en", threshold: float = 0.5) -> List[Dict[str, Any]]:
        """
        Detect PHI in multiple texts
        
        Args:
            texts: List of texts to analyze
            language: Language code
            threshold: Minimum confidence threshold
        
        Returns:
            List of detection results
        """
        return [self.detect_phi(text, language, threshold) for text in texts]

def main():
    """
    CLI interface for PHI detection
    Expected input format (JSON):
    {
        "text": "string" or "texts": ["string1", "string2"],
        "language": "en" (optional),
        "threshold": 0.5 (optional)
    }
    """
    try:
        input_data = json.loads(sys.stdin.read())
        
        service = PHIDetectionService()
        
        text = input_data.get("text")
        texts = input_data.get("texts")
        language = input_data.get("language", "en")
        threshold = input_data.get("threshold", 0.5)
        
        if text is not None:
            result = service.detect_phi(text, language, threshold)
            print(json.dumps(result))
        elif texts is not None:
            results = service.batch_detect(texts, language, threshold)
            print(json.dumps(results))
        else:
            print(json.dumps({"error": "Either 'text' or 'texts' must be provided"}))
            sys.exit(1)
            
    except Exception as e:
        error_result = {
            "error": str(e),
            "type": type(e).__name__
        }
        print(json.dumps(error_result))
        sys.exit(1)

if __name__ == "__main__":
    main()
