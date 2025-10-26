/**
 * Clinical Validation Service
 * 
 * Evaluates AI system responses against evidence-based ground truth
 * Provides structured scoring and feedback
 */

import type { ClinicalTestCase } from './datasets';
import { logger } from '../../logger';

export interface ValidationResult {
  testCaseId: string;
  correct: boolean;
  score: number; // 0-100
  feedback: {
    mustIncludeScore: number;
    mustNotIncludeScore: number;
    conceptScore: number;
    urgencyMatch: boolean;
    diagnosisMatch: boolean;
  };
  details: {
    includedKeywords: string[];
    missingKeywords: string[];
    forbiddenKeywordsFound: string[];
    conceptsIdentified: string[];
    conceptsMissed: string[];
  };
}

export class ClinicalValidator {
  /**
   * Validate AI response against ground truth
   * 
   * @param testCase The clinical scenario with ground truth
   * @param aiResponse The AI system's response
   * @returns Detailed validation result
   */
  validateResponse(testCase: ClinicalTestCase, aiResponse: string): ValidationResult {
    const responseLower = aiResponse.toLowerCase();
    
    // Check must-include keywords
    const includedKeywords: string[] = [];
    const missingKeywords: string[] = [];
    
    for (const keyword of testCase.validationCriteria.mustInclude) {
      if (this.containsKeyword(responseLower, keyword)) {
        includedKeywords.push(keyword);
      } else {
        missingKeywords.push(keyword);
      }
    }
    
    const mustIncludeScore = (includedKeywords.length / testCase.validationCriteria.mustInclude.length) * 100;
    
    // Check must-not-include keywords (forbidden terms)
    // CRITICAL: Check for negation context to avoid false positives
    const forbiddenKeywordsFound: string[] = [];
    
    for (const keyword of testCase.validationCriteria.mustNotInclude) {
      // Only flag if keyword appears WITHOUT negation
      if (this.containsKeywordWithoutNegation(aiResponse, keyword)) {
        forbiddenKeywordsFound.push(keyword);
      }
    }
    
    // Penalty for forbidden keywords (100 points for zero forbidden, decreases linearly)
    const mustNotIncludeScore = Math.max(0, 100 - (forbiddenKeywordsFound.length * 50));
    
    // Check concept comprehension
    const conceptsIdentified: string[] = [];
    const conceptsMissed: string[] = [];
    
    for (const concept of testCase.validationCriteria.conceptsRequired) {
      if (this.containsConcept(responseLower, concept)) {
        conceptsIdentified.push(concept);
      } else {
        conceptsMissed.push(concept);
      }
    }
    
    const conceptScore = (conceptsIdentified.length / testCase.validationCriteria.conceptsRequired.length) * 100;
    
    // Check urgency alignment
    const urgencyMatch = this.checkUrgencyMatch(responseLower, testCase.groundTruth.urgency);
    
    // Check diagnosis accuracy
    const diagnosisMatch = this.containsKeyword(responseLower, testCase.groundTruth.diagnosis);
    
    // Calculate overall score (weighted average)
    const score = Math.round(
      (mustIncludeScore * 0.35) +        // 35% weight on required keywords
      (mustNotIncludeScore * 0.20) +     // 20% weight on avoiding contraindications
      (conceptScore * 0.30) +            // 30% weight on concept comprehension
      (urgencyMatch ? 10 : 0) +          // 10% bonus for urgency match
      (diagnosisMatch ? 5 : 0)           // 5% bonus for diagnosis match
    );
    
    // Pass if score >= 75
    const correct = score >= 75;
    
    logger.debug({
      testCaseId: testCase.id,
      score,
      correct,
      mustIncludeScore,
      mustNotIncludeScore,
      conceptScore,
      urgencyMatch,
      diagnosisMatch,
    }, 'Clinical validation result');
    
    return {
      testCaseId: testCase.id,
      correct,
      score,
      feedback: {
        mustIncludeScore,
        mustNotIncludeScore,
        conceptScore,
        urgencyMatch,
        diagnosisMatch,
      },
      details: {
        includedKeywords,
        missingKeywords,
        forbiddenKeywordsFound,
        conceptsIdentified,
        conceptsMissed,
      },
    };
  }
  
  /**
   * Check if response contains keyword WITHOUT negation
   * CRITICAL for clinical accuracy: "antibiotics are not indicated" should NOT flag "antibiotics"
   */
  private containsKeywordWithoutNegation(text: string, keyword: string): boolean {
    const textLower = text.toLowerCase();
    const keywordLower = keyword.toLowerCase();
    
    // Find all occurrences of the keyword
    const regex = new RegExp(`\\b${this.escapeRegex(keywordLower)}\\w*\\b`, 'gi');
    const matches = textLower.matchAll(regex);
    
    for (const match of matches) {
      const matchIndex = match.index!;
      
      // Check 30 characters before the match for negation words
      const contextStart = Math.max(0, matchIndex - 30);
      const contextBefore = textLower.slice(contextStart, matchIndex);
      
      // Negation indicators
      const negationWords = ['not', 'no', 'never', 'avoid', 'contraindicated', 'inappropriate', 'unnecessary', 'without', 'exclude'];
      
      // If negation found within 30 chars before keyword, it's negated
      const isNegated = negationWords.some(neg => contextBefore.includes(neg));
      
      // If we find at least one occurrence WITHOUT negation, flag it
      if (!isNegated) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Escape regex special characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  
  /**
   * Check if response contains keyword (handles variations and synonyms)
   */
  private containsKeyword(text: string, keyword: string): boolean {
    const keywordLower = keyword.toLowerCase();
    
    // Clinical synonyms and abbreviations
    const synonyms = this.getClinicalSynonyms(keywordLower);
    
    // Check direct matches and synonyms
    for (const term of [keywordLower, ...synonyms]) {
      // Direct match
      if (text.includes(term)) {
        return true;
      }
      
      // Word boundary match (handles hyphenated terms)
      const regex = new RegExp(`\\b${this.escapeRegex(term)}\\w*\\b`, 'i');
      if (regex.test(text)) {
        return true;
      }
    }
    
    // Check for word variations (e.g., "hypertension" matches "hypertensive")
    const words = text.split(/\s+/);
    for (const word of words) {
      // Stem matching (basic)
      if (word.length >= 4 && keywordLower.length >= 4) {
        const minLen = Math.min(word.length, keywordLower.length);
        const stemLen = Math.max(4, minLen - 2);
        
        if (word.slice(0, stemLen) === keywordLower.slice(0, stemLen)) {
          return true;
        }
      }
    }
    
    return false;
  }
  
  /**
   * Get clinical synonyms and abbreviations for common medical terms
   */
  private getClinicalSynonyms(term: string): string[] {
    const synonymMap: Record<string, string[]> = {
      'myocardial infarction': ['heart attack', 'mi', 'ami', 'stemi', 'nstemi'],
      'catheterization': ['pci', 'angioplasty', 'cath'],
      'hypertension': ['high blood pressure', 'htn', 'elevated bp'],
      'diabetes': ['dm', 't2dm', 'diabetic'],
      'self-limited': ['self-limiting', 'self limiting'],
      'follow-up': ['followup', 'follow up'],
      'antibiotics': ['abx', 'antibiotic'],
      'emergency': ['stat', 'urgent', 'immediate'],
      'hospitalization': ['admission', 'admit', 'inpatient'],
      'stroke': ['cva', 'cerebrovascular accident'],
      'tpa': ['alteplase', 'thrombolysis'],
      'pneumonia': ['cap', 'hap', 'vap'],
    };
    
    // Check if term has known synonyms
    for (const [key, syns] of Object.entries(synonymMap)) {
      if (term.includes(key) || key.includes(term)) {
        return syns;
      }
    }
    
    return [];
  }
  
  /**
   * Check if response contains concept (more flexible than keyword matching)
   */
  private containsConcept(text: string, concept: string): boolean {
    const conceptLower = concept.toLowerCase();
    
    // Split concept into words
    const conceptWords = conceptLower.split(/\s+/);
    
    // Response must contain majority of concept words
    let matchCount = 0;
    for (const word of conceptWords) {
      if (word.length <= 3) continue; // Skip short words like "is", "the"
      if (this.containsKeyword(text, word)) {
        matchCount++;
      }
    }
    
    // Match if >= 50% of significant words present
    const significantWords = conceptWords.filter(w => w.length > 3);
    return matchCount >= Math.ceil(significantWords.length * 0.5);
  }
  
  /**
   * Check if urgency level matches
   */
  private checkUrgencyMatch(text: string, urgency: 'routine' | 'urgent' | 'emergency'): boolean {
    const urgencyKeywords = {
      emergency: ['emergency', 'immediate', 'urgent', 'stat', 'critical', 'life-threatening', 'activate'],
      urgent: ['urgent', 'soon', 'promptly', 'expedited', 'priority'],
      routine: ['routine', 'scheduled', 'elective', 'outpatient', 'follow-up'],
    };
    
    const keywords = urgencyKeywords[urgency];
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Batch validate multiple test cases
   */
  validateBatch(testCases: ClinicalTestCase[], aiResponses: string[]): ValidationResult[] {
    if (testCases.length !== aiResponses.length) {
      throw new Error('Test cases and responses arrays must have same length');
    }
    
    return testCases.map((tc, index) => this.validateResponse(tc, aiResponses[index]));
  }
  
  /**
   * Generate human-readable feedback
   */
  generateFeedback(result: ValidationResult, testCase: ClinicalTestCase): string {
    const feedback: string[] = [];
    
    if (result.correct) {
      feedback.push(`✓ Response passed clinical validation (score: ${result.score}/100)`);
    } else {
      feedback.push(`✗ Response failed clinical validation (score: ${result.score}/100, threshold: 75)`);
    }
    
    if (result.details.missingKeywords.length > 0) {
      feedback.push(`Missing key clinical terms: ${result.details.missingKeywords.join(', ')}`);
    }
    
    if (result.details.forbiddenKeywordsFound.length > 0) {
      feedback.push(`⚠ Contraindicated terms found: ${result.details.forbiddenKeywordsFound.join(', ')}`);
    }
    
    if (result.details.conceptsMissed.length > 0) {
      feedback.push(`Concepts not adequately addressed: ${result.details.conceptsMissed.join(', ')}`);
    }
    
    if (!result.feedback.urgencyMatch) {
      feedback.push(`⚠ Failed to appropriately convey urgency level: ${testCase.groundTruth.urgency}`);
    }
    
    if (!result.feedback.diagnosisMatch) {
      feedback.push(`⚠ Did not identify correct diagnosis: ${testCase.groundTruth.diagnosis}`);
    }
    
    return feedback.join('\n');
  }
}

// Singleton instance
export const clinicalValidator = new ClinicalValidator();
