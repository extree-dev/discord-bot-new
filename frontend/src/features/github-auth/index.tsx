import { Button } from '../../shared/ui/Button';

interface GitHubLoginButtonProps {
    label: string;
    fullWidth?: boolean;
}

// GitHub — обычный redirect OAuth2, как Discord/Google (см. LoginButton,
// GoogleLoginButton), без виджета/JS SDK, в отличие от Telegram —
// поэтому работает одинаково на обоих доменах.
export function GitHubLoginButton({ label, fullWidth = true }: GitHubLoginButtonProps) {
    return (
        <Button href="/auth/github/login" variant="default" fullWidth={fullWidth}>
            {label}
        </Button>
    );
}
