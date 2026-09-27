import { SignIn } from '@clerk/nextjs';
import { clerkAppearance } from '../../_clerk-appearance';

export default function SignInPage() {
  return (
    <SignIn
      appearance={clerkAppearance as any}
      signUpUrl="/sign-up"
      forceRedirectUrl="/dashboard"
    />
  );
}
