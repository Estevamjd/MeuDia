import { RuntimeAppConfig } from '../../components/RuntimeAppConfig';

// O onboarding lê o modo (useAppMode): APP_MODE por request, como no dashboard.
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <RuntimeAppConfig>{children}</RuntimeAppConfig>;
}
