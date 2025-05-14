export interface WeavyComponentAgentProps {
  /**
   * The configured uid of the agent for the weavy component.
   */
  agent?: string | null;

  /**
   * Any specific instructions for the agent. Overrides any pre configured agent instructions.
   */
  instructions?: string;
}
