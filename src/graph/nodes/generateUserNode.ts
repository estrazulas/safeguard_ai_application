import type { GraphState } from '../state.ts';
import { getUser, type User } from '../../config.ts';

/**
 * Validate and finalize user initialization.
 * This node ONLY receives a user if extract_user found one.
 * If user is missing here, something went wrong → fail safely.
 */
export const generateUserNode = async (state: GraphState): Promise<Partial<GraphState>> => {
    try {
        const user = state.user;

        // User should always be set if we reach this node
        // (extract_user routes to blocked if not found)
        if (!user) {
            throw new Error(
                'User validation failed: user should be set by extract_user node'
            );
        }

        // Validate user has required fields
        if (!user.role || !user.displayName) {
            throw new Error(
                `Invalid user object - missing required fields. User: ${JSON.stringify(user)}`
            );
        }

        console.log(`✅ User validated: ${user.displayName} (${user.role})`);
        
        return {
            user,
            guardrailsEnabled: user.role === 'admin' ? false : (state.guardrailsEnabled ?? true),
        };
    } catch (error) {
        console.error('❌ User validation failed:', error);
        
        // Return error state that will trigger blocked node
        return {
            guardrailCheck: {
                safe: false,
                reason: `User validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            }
        };
    }
};
