#!/usr/bin/env python3
"""
Fairlearn Bias Testing Service
Detects bias in AI model predictions across protected attributes (race, gender, age)
Uses demographic parity, equalized odds, and disparate impact metrics
"""

import sys
import json
import numpy as np
import pandas as pd
from typing import Dict, List, Any, Optional
from fairlearn.metrics import (
    demographic_parity_difference,
    demographic_parity_ratio,
    equalized_odds_difference,
    equalized_odds_ratio,
    MetricFrame
)
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score


def analyze_bias(
    predictions: List[int],
    ground_truth: List[int],
    sensitive_features: Dict[str, List[Any]],
    threshold: float = 0.8
) -> Dict[str, Any]:
    """
    Analyze bias in model predictions across sensitive attributes.
    
    Args:
        predictions: Model predictions (0 or 1 for binary classification)
        ground_truth: True labels
        sensitive_features: Dict of sensitive attribute names to values
        threshold: Threshold for demographic parity ratio (default: 0.8 = 80% fairness)
    
    Returns:
        Dict with bias analysis results
    """
    try:
        # Convert to numpy arrays
        y_pred = np.array(predictions)
        y_true = np.array(ground_truth)
        
        results = {
            "overall_metrics": {
                "accuracy": float(accuracy_score(y_true, y_pred)),
                "precision": float(precision_score(y_true, y_pred, zero_division=0.0)),
                "recall": float(recall_score(y_true, y_pred, zero_division=0.0)),
                "f1_score": float(f1_score(y_true, y_pred, zero_division=0.0))
            },
            "bias_metrics": {},
            "group_metrics": {},
            "bias_detected": False,
            "violations": []
        }
        
        # Analyze each sensitive feature
        for feature_name, feature_values in sensitive_features.items():
            sf = pd.Series(feature_values)
            
            # Calculate fairness metrics
            dp_diff = demographic_parity_difference(y_true, y_pred, sensitive_features=sf)
            dp_ratio = demographic_parity_ratio(y_true, y_pred, sensitive_features=sf)
            eo_diff = equalized_odds_difference(y_true, y_pred, sensitive_features=sf)
            eo_ratio = equalized_odds_ratio(y_true, y_pred, sensitive_features=sf)
            
            results["bias_metrics"][feature_name] = {
                "demographic_parity_difference": float(dp_diff),
                "demographic_parity_ratio": float(dp_ratio),
                "equalized_odds_difference": float(eo_diff),
                "equalized_odds_ratio": float(eo_ratio)
            }
            
            # Calculate per-group metrics
            metric_frame = MetricFrame(
                metrics={
                    "accuracy": accuracy_score,
                    "precision": lambda y_true, y_pred: precision_score(y_true, y_pred, zero_division=0.0),
                    "recall": lambda y_true, y_pred: recall_score(y_true, y_pred, zero_division=0.0)
                },
                y_true=y_true,
                y_pred=y_pred,
                sensitive_features=sf
            )
            
            # Convert to serializable format
            group_metrics = {}
            for group in metric_frame.by_group.index:
                group_metrics[str(group)] = {
                    metric: float(value) 
                    for metric, value in metric_frame.by_group.loc[group].items()
                }
            
            results["group_metrics"][feature_name] = group_metrics
            
            # Check for bias violations
            if dp_ratio < threshold:
                results["bias_detected"] = True
                results["violations"].append({
                    "feature": feature_name,
                    "metric": "demographic_parity_ratio",
                    "value": float(dp_ratio),
                    "threshold": threshold,
                    "severity": "high" if dp_ratio < 0.6 else "medium",
                    "description": f"Model shows unfair treatment across {feature_name} groups (ratio: {dp_ratio:.2f})"
                })
            
            if eo_ratio < threshold:
                results["bias_detected"] = True
                results["violations"].append({
                    "feature": feature_name,
                    "metric": "equalized_odds_ratio",
                    "value": float(eo_ratio),
                    "threshold": threshold,
                    "severity": "high" if eo_ratio < 0.6 else "medium",
                    "description": f"Model shows unequal error rates across {feature_name} groups (ratio: {eo_ratio:.2f})"
                })
        
        return results
        
    except Exception as e:
        return {
            "error": str(e),
            "type": type(e).__name__
        }


def calculate_disparate_impact(
    predictions: List[int],
    sensitive_feature: List[Any],
    privileged_group: Any
) -> Dict[str, Any]:
    """
    Calculate disparate impact ratio (4/5ths rule).
    
    Args:
        predictions: Model predictions
        sensitive_feature: Sensitive attribute values
        privileged_group: Value representing the privileged group
    
    Returns:
        Dict with disparate impact analysis
    """
    try:
        y_pred = np.array(predictions)
        sf = np.array(sensitive_feature)
        
        # Calculate positive prediction rates
        privileged_mask = sf == privileged_group
        unprivileged_mask = ~privileged_mask
        
        privileged_positive_rate = y_pred[privileged_mask].mean()
        unprivileged_positive_rate = y_pred[unprivileged_mask].mean()
        
        # Disparate impact ratio
        if privileged_positive_rate == 0:
            disparate_impact = 0.0
        else:
            disparate_impact = unprivileged_positive_rate / privileged_positive_rate
        
        # 4/5ths rule: ratio should be >= 0.8
        passes_four_fifths = disparate_impact >= 0.8
        
        return {
            "disparate_impact_ratio": float(disparate_impact),
            "privileged_positive_rate": float(privileged_positive_rate),
            "unprivileged_positive_rate": float(unprivileged_positive_rate),
            "passes_four_fifths_rule": passes_four_fifths,
            "bias_detected": not passes_four_fifths,
            "severity": "none" if passes_four_fifths else ("high" if disparate_impact < 0.6 else "medium")
        }
        
    except Exception as e:
        return {
            "error": str(e),
            "type": type(e).__name__
        }


def main():
    """Main entry point for bias testing service."""
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No input provided"}))
        sys.exit(1)
    
    try:
        input_data = json.loads(sys.argv[1])
        operation = input_data.get("operation", "analyze_bias")
        
        if operation == "analyze_bias":
            result = analyze_bias(
                predictions=input_data["predictions"],
                ground_truth=input_data["ground_truth"],
                sensitive_features=input_data["sensitive_features"],
                threshold=input_data.get("threshold", 0.8)
            )
        elif operation == "disparate_impact":
            result = calculate_disparate_impact(
                predictions=input_data["predictions"],
                sensitive_feature=input_data["sensitive_feature"],
                privileged_group=input_data["privileged_group"]
            )
        else:
            result = {"error": f"Unknown operation: {operation}"}
        
        print(json.dumps(result))
        
    except Exception as e:
        print(json.dumps({
            "error": str(e),
            "type": type(e).__name__
        }))
        sys.exit(1)


if __name__ == "__main__":
    main()
