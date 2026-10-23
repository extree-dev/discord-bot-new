import { EmptyState } from '../../shared/ui/EmptyState';

export function AdminTicketsPlaceholder() {
    return (
        <EmptyState
            icon={
                <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
            }
            title="Select a ticket"
            description="Pick a ticket from the list on the left to view the conversation and reply."
        />
    );
}
