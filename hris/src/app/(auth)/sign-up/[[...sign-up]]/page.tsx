import { SignUp } from '@clerk/nextjs';
import { clerkAppearance } from '../../_clerk-appearance';

export default function SignUpPage() {
  return (
    <SignUp
      appearance={clerkAppearance as any}
      signInUrl="/sign-in"
      forceRedirectUrl="/dashboard"
    />
  );
}
