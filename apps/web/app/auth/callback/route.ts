import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '../../../lib/supabase/server';
import { resolveSafeRedirectUrl } from '../../../lib/auth/callback';
import { getAppMode, rotaInicial } from '../../../lib/app-mode';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const nextUrl = resolveSafeRedirectUrl(searchParams.get('next'), origin);

  const errorUrl = new URL('/login?erro=confirmacao', origin);

  if (!code && !(tokenHash && type)) {
    return NextResponse.redirect(errorUrl);
  }

  try {
    const supabase = createServerSupabaseClient();

    const { error } = code
      ? await supabase.auth.exchangeCodeForSession(code)
      : await supabase.auth.verifyOtp({ token_hash: tokenHash!, type: type! });

    if (error) {
      return NextResponse.redirect(errorUrl);
    }

    if (nextUrl) {
      return NextResponse.redirect(nextUrl);
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Mesma regra do layout do dashboard: sem onboarding concluído vai para /onboarding
    // (que respeita o APP_MODE); caso contrário, rota inicial do modo.
    let destino = rotaInicial(getAppMode());
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_feito')
        .eq('id', user.id)
        .maybeSingle();
      if (!profile?.onboarding_feito) {
        destino = '/onboarding';
      }
    }

    return NextResponse.redirect(new URL(destino, origin));
  } catch {
    return NextResponse.redirect(errorUrl);
  }
}
