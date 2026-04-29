import { PromptTemplate } from '@langchain/core/prompts';
import { OpenRouterService } from '../../services/openrouterService.ts';
import type { GraphState } from '../state.ts';
import { prompts } from '../../config.ts';

export const createGuardrailsCheckNode = (openRouterService: OpenRouterService) => {
    return async (state: GraphState): Promise<Partial<GraphState>> => {
        try {
            // Validate state.user exists (should be set by generateUserNode)
            if (!state.user || !state.user.role || !state.user.displayName) {
                throw new Error(
                    `Invalid state: user must be initialized. Got: ${JSON.stringify(state.user)}`
                );
            }
           
            const userPrompt = state.messages.at(-1)?.text!
            const template = PromptTemplate.fromTemplate(prompts.system)
            // exemplo abaixo é mais inseguro!!
            // const systemPrompt = prompts.system
            //  .replace('{USER_ROLE}', state.user.role);
            //  .replace('{USER_NAME}', state.user.displayName);

            const systemPrompt = await template.format({
                USER_ROLE: state.user.role,
                USER_NAME: state.user.displayName
            })

            const msg = systemPrompt.concat('\n', userPrompt)

            const result = await openRouterService.checkGuardRails(
                msg,
                state.guardrailsEnabled,
            )

            return {
                guardrailCheck: result
            };
        } catch (error) {
            console.error('Guardrails check failed:', error);

            return {
                guardrailCheck:{ safe: false, reason: 'Guardrails check failed - request blocked for safety reasons.'},
            };
        }
    }
}
