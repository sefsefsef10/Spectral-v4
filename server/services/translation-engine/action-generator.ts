/**
 * 🔒 TRANSLATION ENGINE - Action Generator
 * 
 * Translates compliance violations → Required remediation actions
 * Determines who needs to do what, by when, and whether it can be automated
 */

import type { ComplianceViolation, RequiredAction, Severity } from "./types";

export interface ActionWithViolation extends RequiredAction {
  violationId?: string; // Added to track which violation generated this action
}

export class ActionGenerator {
  /**
   * Generate required actions from compliance violations
   * Returns actions grouped by the violation that generated them
   */
  generate(violations: ComplianceViolation[]): Map<ComplianceViolation, RequiredAction[]> {
    const actionsByViolation = new Map<ComplianceViolation, RequiredAction[]>();
    
    violations.forEach(violation => {
      let actions: RequiredAction[] = [];
      
      switch (violation.framework) {
        case 'HIPAA':
          actions = this.generateHIPAAActions(violation);
          break;
        
        case 'NIST_AI_RMF':
          actions = this.generateNISTActions(violation);
          break;
        
        case 'FDA_SaMD':
          actions = this.generateFDAActions(violation);
          break;
        
        case 'CA_SB1047':
          actions = this.generateCaliforniaActions(violation);
          break;
        
        case 'NYC_LL144':
          actions = this.generateNYCActions(violation);
          break;
      }
      
      // Prioritize actions for this specific violation
      const prioritizedActions = this.prioritizeActions(actions);
      actionsByViolation.set(violation, prioritizedActions);
    });
    
    return actionsByViolation;
  }
  
  /**
   * HIPAA Actions
   */
  private generateHIPAAActions(violation: ComplianceViolation): RequiredAction[] {
    const actions: RequiredAction[] = [];
    
    // Breach Notification (164.402)
    if (violation.controlId === '164.402') {
      // Immediate privacy officer notification
      actions.push({
        actionType: 'notify',
        priority: 'immediate',
        description: 'Notify Privacy Officer of potential PHI breach immediately. Begin breach investigation protocol.',
        assignee: 'privacy_officer',
        deadline: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours
        automated: true, // Auto-send email/SMS
        actionDetails: {
          notificationChannels: ['email', 'sms', 'dashboard'],
          escalationPath: ['privacy_officer', 'ciso', 'compliance_officer'],
        },
      });
      
      // Document breach details
      actions.push({
        actionType: 'document',
        priority: 'urgent',
        description: 'Document breach details: scope, affected individuals, timeline, and initial investigation findings for HHS reporting.',
        assignee: 'compliance_officer',
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        automated: false,
        actionDetails: {
          requiredFields: [
            'date_of_breach',
            'date_discovered',
            'affected_individuals_count',
            'phi_elements_exposed',
            'breach_cause',
            'mitigation_steps',
          ],
        },
      });
      
      // Critical: Rollback if severe
      if (violation.severity === 'critical') {
        actions.push({
          actionType: 'rollback',
          priority: 'immediate',
          description: `Rollback AI system "${violation.affectedSystem.name}" to last known secure version to prevent further PHI exposure.`,
          assignee: 'it_owner',
          deadline: new Date(Date.now() + 1 * 60 * 60 * 1000), // 1 hour
          automated: false, // Requires manual approval due to clinical impact
          actionDetails: {
            systemId: violation.affectedSystem.id,
            requiresApproval: true,
            approvers: ['ciso', 'clinical_owner'],
          },
        });
      }
    }
    
    // Audit Controls (164.312(b))
    if (violation.controlId === '164.312(b)') {
      actions.push({
        actionType: 'escalate',
        priority: violation.severity === 'critical' ? 'urgent' : 'high',
        description: `Escalate AI system performance issue to governance committee. System activity review required per HIPAA audit controls.`,
        assignee: 'ciso',
        deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
        automated: true,
        actionDetails: {
          escalationPath: ['ciso', 'governance_committee'],
          meetingRequired: true,
        },
      });
    }
    
    return actions;
  }
  
  /**
   * NIST AI RMF Actions
   */
  private generateNISTActions(violation: ComplianceViolation): RequiredAction[] {
    const actions: RequiredAction[] = [];
    
    // Performance Monitoring (MANAGE-4.1)
    if (violation.controlId === 'MANAGE-4.1') {
      actions.push({
        actionType: 'escalate',
        priority: 'high',
        description: `Escalate to AI governance committee for performance degradation review. NIST AI RMF requires documented performance monitoring and response.`,
        assignee: 'ciso',
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        automated: true,
        actionDetails: {
          frameworkReference: 'NIST AI RMF MANAGE-4.1',
          requiredDocumentation: [
            'Performance metrics analysis',
            'Root cause investigation',
            'Remediation plan',
          ],
        },
      });
      
      actions.push({
        actionType: 'document',
        priority: 'medium',
        description: 'Update AI risk assessment with performance degradation findings. Document in AI system risk register.',
        assignee: 'compliance_officer',
        deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
        automated: false,
        actionDetails: {
          artifact: 'ai_risk_register',
          systemId: violation.affectedSystem.id,
        },
      });
    }
    
    // Fairness Monitoring (MEASURE-2.1)
    if (violation.controlId === 'MEASURE-2.1') {
      actions.push({
        actionType: 'document',
        priority: 'high',
        description: 'Conduct bias audit and document findings. NIST AI RMF requires fairness metrics tracking and demographic disparity analysis.',
        assignee: 'compliance_officer',
        deadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days
        automated: false,
        actionDetails: {
          requiredAnalysis: [
            'demographic_breakdown',
            'performance_by_group',
            'disparity_metrics',
            'mitigation_recommendations',
          ],
        },
      });
    }
    
    // Continuous Risk Management (MANAGE-1.1)
    if (violation.controlId === 'MANAGE-1.1') {
      actions.push({
        actionType: 'escalate',
        priority: violation.severity === 'high' ? 'urgent' : 'medium',
        description: 'Escalate AI risk incident to risk management committee. Continuous monitoring required per NIST AI RMF.',
        assignee: 'ciso',
        deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days
        automated: true,
      });
    }
    
    return actions;
  }
  
  /**
   * FDA Actions
   */
  private generateFDAActions(violation: ComplianceViolation): RequiredAction[] {
    const actions: RequiredAction[] = [];
    
    // Post-Market Surveillance (FDA-PCCP-2)
    if (violation.controlId === 'FDA-PCCP-2') {
      // FDA reporting required
      actions.push({
        actionType: 'notify',
        priority: 'immediate',
        description: `Prepare FDA notification of AI medical device performance issue. Performance degradation exceeds predetermined change control threshold.`,
        assignee: 'compliance_officer',
        deadline: violation.reportingDeadline || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        automated: false, // Requires human review for FDA submission
        actionDetails: {
          regulatoryBody: 'FDA',
          submissionType: 'Post-Market Surveillance Report',
          requiredDocuments: [
            'Performance analysis',
            'Root cause investigation',
            'Corrective action plan',
            'Timeline for resolution',
          ],
        },
      });
      
      // Restrict system use pending review
      if (violation.severity === 'high' || violation.severity === 'critical') {
        actions.push({
          actionType: 'restrict',
          priority: 'urgent',
          description: `Restrict AI medical device use until FDA review and corrective action complete. Clinical owner must implement temporary workflow alternative.`,
          assignee: 'clinical_owner',
          deadline: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
          automated: false,
          actionDetails: {
            restrictionType: 'conditional_use',
            requiresApproval: true,
            alternativeWorkflow: 'manual_process',
          },
        });
      }
    }
    
    return actions;
  }
  
  /**
   * California Actions
   */
  private generateCaliforniaActions(violation: ComplianceViolation): RequiredAction[] {
    const actions: RequiredAction[] = [];
    
    if (violation.controlId === 'CA-BREACH') {
      // Notify affected individuals
      actions.push({
        actionType: 'notify',
        priority: 'immediate',
        description: 'Prepare notification for affected California residents and Attorney General. CA law requires notification within 30 days.',
        assignee: 'privacy_officer',
        deadline: violation.reportingDeadline || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        automated: false,
        actionDetails: {
          regulatoryBody: 'California Attorney General',
          affectedParties: 'california_residents',
        },
      });
    }
    
    return actions;
  }
  
  /**
   * NYC Actions
   */
  private generateNYCActions(violation: ComplianceViolation): RequiredAction[] {
    const actions: RequiredAction[] = [];
    
    if (violation.controlId === 'NYC-BIAS') {
      actions.push({
        actionType: 'document',
        priority: 'high',
        description: 'Conduct annual bias audit as required by NYC Local Law 144. Must be published publicly.',
        assignee: 'compliance_officer',
        deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
        automated: false,
        actionDetails: {
          auditType: 'bias_audit',
          publicationRequired: true,
          framework: 'NYC Local Law 144',
        },
      });
    }
    
    return actions;
  }
  
  /**
   * Prioritize and deduplicate actions
   */
  private prioritizeActions(actions: RequiredAction[]): RequiredAction[] {
    // Remove duplicates (same actionType + assignee + system)
    const unique = this.deduplicateActions(actions);
    
    // Sort by priority and deadline
    return unique.sort((a, b) => {
      const priorityOrder = {
        immediate: 0,
        urgent: 1,
        high: 2,
        medium: 3,
        low: 4,
      };
      
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      
      return a.deadline.getTime() - b.deadline.getTime();
    });
  }
  
  private deduplicateActions(actions: RequiredAction[]): RequiredAction[] {
    const map = new Map<string, RequiredAction>();
    
    actions.forEach(action => {
      const key = `${action.actionType}-${action.assignee}-${action.description.substring(0, 50)}`;
      const existing = map.get(key);
      
      if (!existing || this.isPriorityHigher(action.priority, existing.priority)) {
        map.set(key, action);
      }
    });
    
    return Array.from(map.values());
  }
  
  private isPriorityHigher(a: string, b: string): boolean {
    const priorityOrder = { immediate: 0, urgent: 1, high: 2, medium: 3, low: 4 };
    return priorityOrder[a as keyof typeof priorityOrder] < priorityOrder[b as keyof typeof priorityOrder];
  }
}
