export interface LightfastLastActiveOrg {
  id: string;
  slug: string;
}

export interface LightfastSessionClaims {
  last_active_org?: LightfastLastActiveOrg | null;
  lf_binding_status?: string;
  lf_next_setup_requirement?: string;
}

declare global {
  interface CustomJwtSessionClaims extends LightfastSessionClaims {}
}
