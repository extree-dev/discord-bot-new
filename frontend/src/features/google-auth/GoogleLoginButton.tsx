import { Button } from '../../shared/ui/Button';

interface GoogleLoginButtonProps {
    label: string;
    fullWidth?: boolean;
}

// Google — обычный redirect OAuth2, как Discord (см. LoginButton), без
// виджета/JS SDK, в отличие от Telegram — поэтому работает одинаково на
// обоих доменах.
export function GoogleLoginButton({ label, fullWidth = true }: GoogleLoginButtonProps) {
    return (
        <Button href="/auth/google/login" variant="default" fullWidth={fullWidth}>
            {label}
        </Button>
    );
}
