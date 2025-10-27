#!/usr/bin/env python3
"""
Fairlearn-based Bias Detection Service

Uses Microsoft's Fairlearn library to detect algorithmic bias in AI model outputs
across protected demographic groups (race, gender, age).

Calculates fairness metrics including:
- Demographic Parity Difference
- Equalized Odds Difference  
- Disparate Impact Ratio
"""

import json
import sys
import numpy as np
from typing import List, Dict, Any

try:
    from fairlearn.metrics import (
        demographic_parity_difference,
        equalized_odds_difference,
        MetricFrame
    )
    from sklearn.metrics import accuracy_score
except ImportError as e:
    print(json.dumps({"error": f"Failed to import required libraries: {str(e)}"}), file=sys.stderr)
    sys.exit(1)


def calculate_bias_metrics(predictions: List[int], labels: List[int], sensitive_features: List[str]) -> Dict[str, Any]:
    """
    Calculate bias metrics using Fairlearn
    
    Args:
        predictions: Model predictions (0 or 1 for binary classification)
        labels: Ground truth labels
        sensitive_features: Protected group membership (e.g., 'male', 'female', 'caucasian', 'african_american')
    
    Returns:
        Dictionary with bias metrics and fairness assessment
    """
    try:
        predictions = np.array(predictions)
        labels = np.array(labels)
        sensitive_features = np.array(sensitive_features)
        
        # Calculate demographic parity difference (should be close to 0)
        # Measures difference in positive prediction rates between groups
        dp_diff = demographic_parity_difference(
            y_true=labels,
            y_pred=predictions,
            sensitive_features=sensitive_features
        )
        
        # Calculate equalized odds difference (should be close to 0)
        # Measures difference in true positive and false positive rates
        eo_diff = equalized_odds_difference(
            y_true=labels,
            y_pred=predictions,
            sensitive_features=sensitive_features
        )
        
        # Calculate accuracy per group using MetricFrame
        metric_frame = MetricFrame(
            metrics=accuracy_score,
            y_true=labels,
            y_pred=predictions,
            sensitive_features=sensitive_features
        )
        
        group_accuracies = metric_frame.by_group.to_dict()
        overall_accuracy = metric_frame.overall
        
        # Calculate disparate impact (ratio of min/max group positive rates)
        # Should be close to 1.0 (perfect fairness)
        unique_groups = np.unique(sensitive_features)
        positive_rates = {}
        
        for group in unique_groups:
            group_mask = sensitive_features == group
            group_preds = predictions[group_mask]
            if len(group_preds) > 0:
                positive_rates[group] = np.mean(group_preds)
        
        min_rate = min(positive_rates.values()) if positive_rates else 0
        max_rate = max(positive_rates.values()) if positive_rates else 1
        disparate_impact = min_rate / max_rate if max_rate > 0 else 0
        
        # Determine if bias is detected based on thresholds
        # Industry standards:
        # - DP diff < 0.1 = fair
        # - EO diff < 0.1 = fair  
        # - Disparate impact 0.8-1.25 = fair (80% rule)
        bias_detected = (
            abs(dp_diff) > 0.1 or 
            abs(eo_diff) > 0.1 or 
            disparate_impact < 0.8 or 
            disparate_impact > 1.25
        )
        
        # Calculate severity
        if bias_detected:
            if abs(dp_diff) > 0.2 or abs(eo_diff) > 0.2 or disparate_impact < 0.6:
                severity = 'high'
            elif abs(dp_diff) > 0.15 or abs(eo_diff) > 0.15 or disparate_impact < 0.7:
                severity = 'medium'
            else:
                severity = 'low'
        else:
            severity = 'none'
        
        # Handle NaN values before JSON serialization
        # NaN occurs when equalized odds has divide-by-zero (all predictions same class)
        import math
        
        dp_diff = 0.0 if math.isnan(dp_diff) else dp_diff
        eo_diff = 0.0 if math.isnan(eo_diff) else eo_diff
        disparate_impact = 1.0 if math.isnan(disparate_impact) else disparate_impact
        overall_accuracy = 0.0 if math.isnan(overall_accuracy) else overall_accuracy
        
        # Clean nested dicts
        group_accuracies = {str(k): (0.0 if math.isnan(v) else float(v)) for k, v in group_accuracies.items()}
        positive_rates = {str(k): (0.0 if math.isnan(v) else float(v)) for k, v in positive_rates.items()}
        
        return {
            "bias_detected": bool(bias_detected),
            "severity": severity,
            "metrics": {
                "demographic_parity_difference": float(dp_diff),
                "equalized_odds_difference": float(eo_diff),
                "disparate_impact_ratio": float(disparate_impact)
            },
            "group_accuracies": group_accuracies,
            "overall_accuracy": float(overall_accuracy),
            "positive_rates": positive_rates,
            "recommendations": generate_recommendations(dp_diff, eo_diff, disparate_impact)
        }
        
    except Exception as e:
        return {
            "error": f"Failed to calculate bias metrics: {str(e)}"
        }


def generate_recommendations(dp_diff: float, eo_diff: float, disparate_impact: float) -> List[str]:
    """Generate actionable recommendations based on bias metrics"""
    recommendations = []
    
    if abs(dp_diff) > 0.1:
        recommendations.append(
            f"Demographic parity violation detected ({dp_diff:.3f}). "
            "Consider rebalancing training data or using fairness constraints."
        )
    
    if abs(eo_diff) > 0.1:
        recommendations.append(
            f"Equalized odds violation detected ({eo_diff:.3f}). "
            "Model performs differently across groups - review decision thresholds."
        )
    
    if disparate_impact < 0.8:
        recommendations.append(
            f"Disparate impact ratio too low ({disparate_impact:.3f}). "
            "This violates the 80% rule - model may have discriminatory impact."
        )
    elif disparate_impact > 1.25:
        recommendations.append(
            f"Disparate impact ratio too high ({disparate_impact:.3f}). "
            "Model shows unexpected favor toward certain groups."
        )
    
    return recommendations


def main():
    """Process bias detection request from Node.js"""
    try:
        # Read input from stdin
        input_data = json.loads(sys.stdin.read())
        
        predictions = input_data.get("predictions", [])
        labels = input_data.get("labels", [])
        sensitive_features = input_data.get("sensitive_features", [])
        
        if not predictions or not labels or not sensitive_features:
            print(json.dumps({"error": "Missing required input data"}))
            sys.exit(1)
        
        if len(predictions) != len(labels) or len(predictions) != len(sensitive_features):
            print(json.dumps({"error": "Input arrays must have same length"}))
            sys.exit(1)
        
        result = calculate_bias_metrics(predictions, labels, sensitive_features)
        print(json.dumps(result))
        
    except json.JSONDecodeError as e:
        print(json.dumps({"error": f"Invalid JSON input: {str(e)}"}))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({"error": f"Unexpected error: {str(e)}"}))
        sys.exit(1)


if __name__ == "__main__":
    main()
