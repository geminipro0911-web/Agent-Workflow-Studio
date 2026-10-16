export type NodeSkinTheme = 'feudal' | 'capitalist' | 'corporate' | 'cyberpunk';

export interface ThemedRoleInfo {
  themeTitleEn: string;
  themeTitleVi: string;
  subtitleEn: string;
  subtitleVi: string;
  avatarId: string;
  badgeEn: string;
  badgeVi: string;
  primaryColor: string;
  secondaryColor: string;
}

export interface NodeSkinDefinition {
  id: NodeSkinTheme;
  nameEn: string;
  nameVi: string;
  icon: string;
  descriptionEn: string;
  descriptionVi: string;
  containerClass: string;
  headerAccentClass: string;
  roles: Record<string, ThemedRoleInfo>;
}
