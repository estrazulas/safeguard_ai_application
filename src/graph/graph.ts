import { StateGraph, START, END } from '@langchain/langgraph';
import { SafeguardStateAnnotation, type GraphState } from './state.ts';
import { extractUserFromPromptNode } from './nodes/extractUserFromPromptNode.ts';
import { generateUserNode } from './nodes/generateUserNode.ts';
import { createGuardrailsCheckNode } from './nodes/guardrailsCheckNode.ts';
import { createChatNode } from './nodes/chatNode.ts';
import { blockedNode } from './nodes/blockedNode.ts';
import { routeAfterGuardrails } from './nodes/edgeConditions.ts';
import { OpenRouterService } from '../services/openrouterService.ts';

export function buildChatGraph() {

    const service = new OpenRouterService();
    const workflow = new StateGraph({
        stateSchema: SafeguardStateAnnotation
    })
        .addNode('extract_user', extractUserFromPromptNode(service))
        .addNode('generate_user', generateUserNode)
        .addNode('guardrails_check', createGuardrailsCheckNode(service))
        .addNode('chat', createChatNode(service))
        .addNode('blocked', blockedNode)

        // Set entry point: extract user from prompt first
        .addEdge(START, 'extract_user')

        // If user extraction failed (guardrailCheck.safe = false), go to blocked
        // If user extraction succeeded (user set), go to generate_user
        .addConditionalEdges(
            'extract_user',
            (state: GraphState) => {
                // User was successfully extracted
                if (state.user) {
                    return 'user_found';
                }
                // User not found → ask for identification (blocked node shows message)
                return 'user_not_found';
            },
            {
                'user_found': 'generate_user',
                'user_not_found': 'blocked',
            }
        )

        .addEdge('generate_user', 'guardrails_check')

        // Define conditional edge after guardrails check
        .addConditionalEdges(
            'guardrails_check',
            (state: GraphState) => routeAfterGuardrails(state),
            {
                chat: 'chat',
                blocked: 'blocked',
            }
        )

        // Both chat and blocked nodes end the flow
        .addEdge('chat', END)
        .addEdge('blocked', END);

    return workflow.compile();
}
