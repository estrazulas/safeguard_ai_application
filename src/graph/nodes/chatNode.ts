import type { GraphState } from '../state.ts';
import { AIMessage } from '@langchain/core/messages';
import { OpenRouterService } from '../../services/openrouterService.ts';
import { prompts } from '../../config.ts';
import { PromptTemplate } from '@langchain/core/prompts';

export const createChatNode = (openRouterService: OpenRouterService) => {
    return async (state: GraphState): Promise<Partial<GraphState>> => {
        try {
            // User is always initialized by generateUserNode before reaching here
            if (!state.user) {
                throw new Error('User must be initialized before chat node');
            }


            const userPrompt = state.messages?.[state.messages.length - 1]?.text || "";
            const template = PromptTemplate.fromTemplate(prompts.system);
            const systemPrompt = await template.format({ 
                USER_ROLE: state.user.role,
                USER_NAME: state.user.displayName
            });
                        // exemplo abaixo é mais inseguro!!
            // const systemPrompt = prompts.system
            //  .replace('{USER_ROLE}', state.user.role);
            //  .replace('{USER_NAME}', state.user.displayName);

            const respose = await openRouterService.generate(systemPrompt, userPrompt);



            return {
                messages: [new AIMessage(respose)],
            };
        } catch (error) {
            console.error('Chat node error:', error);
            return {
                messages: [new AIMessage('I apologize, but I encountered an error processing your request. Please try again later.')],
            };
        }
    }
}
