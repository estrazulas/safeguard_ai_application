import type { GraphState } from '../state.ts';
import { OpenRouterService } from '../../services/openrouterService.ts';
import { getUser } from '../../config.ts';
import { AIMessage } from '@langchain/core/messages';

/**
 * Extract user identifier from the user's prompt using LLM.
 * 
 * If user found → set state.user and continue to guardrails
 * If user NOT found → return error message asking user to identify themselves
 * 
 * Examples of extraction:
 * - "Hi, I'm John" → extract "John" → getUser("john") → found
 * - "Olá, sou a Ana" → extract "Ana" → getUser("ana") → found
 * - "Hey there" → no user found → ASK USER TO IDENTIFY
 */
export const extractUserFromPromptNode = (openRouterService: OpenRouterService) => {
    return async (state: GraphState): Promise<Partial<GraphState>> => {
        try {
            // If user already in state, skip extraction
            if (state.user) {
                return {}; // no changes
            }

            const userMessage = state.messages.at(-1)?.text || '';
            
            if (!userMessage.trim()) {
                // Empty message
                return {
                    messages: [
                        ...state.messages,
                        new AIMessage('Please identify yourself to continue. Available users: erickwendel (admin) or ananeri (member). Who are you?'),
                    ],
                    guardrailCheck: { safe: false, reason: 'User identification required' },
                };
            }

            // First, try to find known usernames in the message (exact match)
            const knownUsers = ['erickwendel', 'erick', 'ananeri', 'ana'];
            const messageLower = userMessage.toLowerCase();
            
            let extractedName = '';
            for (const user of knownUsers) {
                if (messageLower.includes(user)) {
                    extractedName = user;
                    break;
                }
            }

            // If no known username found, use LLM extraction as fallback
            if (!extractedName) {
                const extractionPrompt = `Extract the user's name or identifier from this message. Return ONLY the name/ID, or "NONE" if not mentioned.

Message: "${userMessage}"

Return only the name (e.g., "John", "Ana", "erickwendel") or "NONE":`;

                const response = await openRouterService.generate(
                    'You are a name extraction assistant. Extract user identifiers from chat messages.',
                    extractionPrompt
                );

                extractedName = response.trim().toLowerCase();
            }

            if (extractedName === 'none' || extractedName === '') {
                // No user mentioned - REQUEST IDENTIFICATION
                console.log('ℹ️  No user identifier found in prompt. Requesting user to identify.');
                return {
                    messages: [
                        ...state.messages,
                        new AIMessage('I need to know who you are to proceed. Please identify yourself. Available users: erickwendel (admin) or ananeri (member).'),
                    ],
                    guardrailCheck: { safe: false, reason: 'User identification required' },
                };
            }

            // Try to load user by extracted name
            const foundUser = getUser(extractedName);
            
            if (foundUser) {
                console.log(`✅ User extracted from prompt: ${extractedName} → ${foundUser.displayName}`);
                return {
                    user: foundUser,
                    guardrailsEnabled: state.guardrailsEnabled ?? true,
                };
            } else {
                // Extracted name not found in system
                console.warn(`⚠️  Extracted username "${extractedName}" not found in system.`);
                return {
                    messages: [
                        ...state.messages,
                        new AIMessage(`User "${extractedName}" not found in the system. Available users: erickwendel (admin) or ananeri (member). Please try again.`),
                    ],
                    guardrailCheck: { safe: false, reason: `User "${extractedName}" not found` },
                };
            }

        } catch (error) {
            console.error('❌ User extraction failed:', error);
            return {
                messages: [
                    ...state.messages,
                    new AIMessage('Error during user identification. Please try again or specify your username: erickwendel or ananeri.'),
                ],
                guardrailCheck: { safe: false, reason: 'User extraction error' },
            };
        }
    };
};
