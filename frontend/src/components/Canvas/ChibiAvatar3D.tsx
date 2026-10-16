import React from 'react';
import { NodeSkinTheme } from '../../types/skins';
import { NodeExecutionStatus } from '../../types';

export type ChibiAction = 'walk' | 'sit' | 'run' | 'panic' | 'cheer';

interface ChibiAvatar3DProps {
  roleId: string;
  skin: NodeSkinTheme;
  status?: NodeExecutionStatus;
  action?: ChibiAction;
  primaryColor?: string;
  size?: number;
}

export const ChibiAvatar3D: React.FC<ChibiAvatar3DProps> = ({
  roleId,
  skin,
  status = 'idle',
  action,
  primaryColor = '#3B82F6',
  size = 84,
}) => {
  // Resolve action if not manually overridden:
  const currentAction: ChibiAction = action || (
    status === 'violation_paused'
      ? 'panic'
      : status === 'running'
      ? 'run'
      : status === 'completed'
      ? 'cheer'
      : status === 'pending' || status === 'waiting_approval' || status === 'queued_lock'
      ? 'sit'
      : 'walk'
  );

  const isViolation = currentAction === 'panic';
  const isRunning = currentAction === 'run';
  const isCompleted = currentAction === 'cheer';
  const isSitting = currentAction === 'sit';

  // Role normalization
  const normalizedRole = roleId.toLowerCase();
  const isPM = normalizedRole.includes('pm');
  const isArch = normalizedRole.includes('arch');
  const isDB = normalizedRole.includes('db') || normalizedRole.includes('database');
  const isBE = normalizedRole.includes('be') || normalizedRole.includes('backend');
  const isFE = normalizedRole.includes('fe') || normalizedRole.includes('frontend');
  const isQA = normalizedRole.includes('qa');
  const isSec = normalizedRole.includes('sec') || normalizedRole.includes('security');

  // Animation class based on action
  const animationClass =
    currentAction === 'panic'
      ? 'chibi-panic drop-shadow-[0_0_20px_rgba(239,68,68,0.95)] scale-110'
      : currentAction === 'run'
      ? 'chibi-sprinting drop-shadow-[0_0_18px_rgba(59,130,246,0.95)]'
      : currentAction === 'cheer'
      ? 'animate-bounce drop-shadow-[0_0_14px_rgba(16,185,129,0.9)]'
      : currentAction === 'sit'
      ? 'chibi-sitting drop-shadow-md'
      : 'chibi-pacing drop-shadow-md';

  return (
    <div
      className={`relative flex items-center justify-center shrink-0 select-none ${animationClass}`}
      style={{ width: size, height: size }}
    >
      {/* 3D Radiant Ambient Glow Aura */}
      <div
        className="absolute inset-0 rounded-full blur-md opacity-70"
        style={{
          background: isViolation
            ? 'radial-gradient(circle, #EF4444 0%, #F97316 70%, transparent 100%)'
            : isRunning
            ? `radial-gradient(circle, ${primaryColor} 0%, rgba(59,130,246,0.3) 60%, transparent 85%)`
            : isCompleted
            ? 'radial-gradient(circle, #10B981 0%, rgba(52,211,153,0.3) 60%, transparent 85%)'
            : isSitting
            ? 'radial-gradient(circle, #F59E0B 0%, rgba(245,158,11,0.2) 50%, transparent 80%)'
            : 'radial-gradient(circle, rgba(255,255,255,0.2) 0%, transparent 80%)',
        }}
      />

      <svg
        viewBox="0 0 100 100"
        className="w-full h-full relative z-10 drop-shadow-lg"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Porcelain Skin 3D Gradient */}
          <radialGradient id={`chibi-head-grad-${skin}-${roleId}`} cx="35%" cy="28%" r="65%">
            <stop offset="0%" stopColor="#FFFBF5" />
            <stop offset="55%" stopColor="#FDE2CD" />
            <stop offset="85%" stopColor="#F6C3A3" />
            <stop offset="100%" stopColor="#E59E75" />
          </radialGradient>

          {/* Imperial Rich Gold (5-stops specular gold) */}
          <linearGradient id="chibi-gold-rich" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFDF0" />
            <stop offset="25%" stopColor="#FDE047" />
            <stop offset="60%" stopColor="#EAB308" />
            <stop offset="85%" stopColor="#B45309" />
            <stop offset="100%" stopColor="#78350F" />
          </linearGradient>

          {/* Translucent Imperial Jade */}
          <linearGradient id="chibi-jade-rich" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#A7F3D0" />
            <stop offset="35%" stopColor="#34D399" />
            <stop offset="75%" stopColor="#059669" />
            <stop offset="100%" stopColor="#064E3B" />
          </linearGradient>

          {/* Royal Ruby Gem */}
          <radialGradient id="chibi-ruby-rich" cx="35%" cy="30%" r="65%">
            <stop offset="0%" stopColor="#FFE4E6" />
            <stop offset="45%" stopColor="#F43F5E" />
            <stop offset="80%" stopColor="#BE123C" />
            <stop offset="100%" stopColor="#4C0519" />
          </radialGradient>

          {/* Polished Titanium / Steel Armor */}
          <linearGradient id="chibi-steel-rich" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F8FAFC" />
            <stop offset="35%" stopColor="#CBD5E1" />
            <stop offset="70%" stopColor="#64748B" />
            <stop offset="100%" stopColor="#1E293B" />
          </linearGradient>

          {/* Silk Robe Crimson */}
          <linearGradient id="chibi-crimson-rich" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FDA4AF" />
            <stop offset="40%" stopColor="#E11D48" />
            <stop offset="85%" stopColor="#9F1239" />
            <stop offset="100%" stopColor="#4C0519" />
          </linearGradient>

          {/* Royal Purple Silk */}
          <linearGradient id="chibi-purple-rich" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#E9D5FF" />
            <stop offset="45%" stopColor="#A855F7" />
            <stop offset="80%" stopColor="#7E22CE" />
            <stop offset="100%" stopColor="#3B0764" />
          </linearGradient>

          {/* Raven Black Hair */}
          <linearGradient id="chibi-hair-raven" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#475569" />
            <stop offset="40%" stopColor="#1E293B" />
            <stop offset="100%" stopColor="#090D16" />
          </linearGradient>

          {/* Cyber Neon Glow */}
          <linearGradient id="chibi-cyber-neon" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38BDF8" />
            <stop offset="50%" stopColor="#818CF8" />
            <stop offset="100%" stopColor="#F43F5E" />
          </linearGradient>

          {/* Anime Iris Gradient */}
          <linearGradient id="chibi-iris-sapphire" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0B1329" />
            <stop offset="50%" stopColor="#1E40AF" />
            <stop offset="100%" stopColor="#38BDF8" />
          </linearGradient>

          {/* Amber Gold Iris (for King) */}
          <linearGradient id="chibi-iris-amber" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#451A03" />
            <stop offset="50%" stopColor="#B45309" />
            <stop offset="100%" stopColor="#FCD34D" />
          </linearGradient>

          {/* 3D Glass / Plastic Specular Highlight */}
          <radialGradient id="chibi-specular-glass" cx="28%" cy="22%" r="28%">
            <stop offset="0%" stopColor="white" stopOpacity="0.85" />
            <stop offset="60%" stopColor="white" stopOpacity="0.2" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* ============================================================== */}
        {/* 1. BASE BODY & LOWER COSTUME (Sitting or Standing Legs) */}
        {/* ============================================================== */}
        {isSitting ? (
          // SITTING POSE: Crossed legs with soft folds
          <g id="chibi-sitting-legs">
            <ellipse cx="34" cy="91" rx="14" ry="5.5" fill="#0F172A" />
            <ellipse cx="66" cy="91" rx="14" ry="5.5" fill="#0F172A" />
            {/* Satin hem cushion */}
            <ellipse cx="50" cy="92" rx="24" ry="4" fill={primaryColor} opacity="0.8" />
            {/* Golden shoe soles tucked */}
            <ellipse cx="23" cy="91" rx="4" ry="3" fill="url(#chibi-gold-rich)" />
            <ellipse cx="77" cy="91" rx="4" ry="3" fill="url(#chibi-gold-rich)" />
          </g>
        ) : (
          // STANDING / WALKING / SPRINTING LEGS: Cute boots
          <g id="chibi-standing-boots">
            <ellipse
              cx="37"
              cy="93"
              rx="7.5"
              ry="4.5"
              fill="#0F172A"
              className={currentAction === 'walk' ? 'chibi-foot-l' : isRunning ? 'animate-bounce' : ''}
            />
            <ellipse
              cx="63"
              cy="93"
              rx="7.5"
              ry="4.5"
              fill="#0F172A"
              className={currentAction === 'walk' ? 'chibi-foot-r' : isRunning ? 'animate-bounce' : ''}
            />
            {/* Golden boot rims */}
            <path d="M30 92H44" stroke="url(#chibi-gold-rich)" strokeWidth="1" />
            <path d="M56 92H70" stroke="url(#chibi-gold-rich)" strokeWidth="1" />
          </g>
        )}

        {/* ============================================================== */}
        {/* 2. THEMED TORSO & DETAILED CLOTHING */}
        {/* ============================================================== */}
        {/* Torso Base */}
        <ellipse cx="50" cy="83" rx="27" ry="15" fill={primaryColor} />

        {/* Feudal Theme: Royal Cross-Collar & Dragon Belt */}
        {skin === 'feudal' && (
          <g id="feudal-torso-details">
            {/* Golden Cross-Collar Lapels */}
            <path d="M34 71L50 85L66 71" stroke="url(#chibi-gold-rich)" strokeWidth="3" fill="none" />
            <path d="M38 71L50 82L62 71" stroke="#FEF08A" strokeWidth="1.5" fill="none" opacity="0.8" />
            {/* Royal Silk Sash Belt */}
            <rect x="25" y="83" width="50" height="5" rx="1.5" fill="#7C2D12" />
            <rect x="25" y="83" width="50" height="1.5" fill="url(#chibi-gold-rich)" />
            {/* Jade Belt Buckle */}
            <circle cx="50" cy="85.5" r="4" fill="url(#chibi-jade-rich)" stroke="url(#chibi-gold-rich)" strokeWidth="1" />
            {/* Chest Insignia for King */}
            {isPM && (
              <circle cx="50" cy="76" r="4.5" fill="url(#chibi-crimson-rich)" stroke="url(#chibi-gold-rich)" strokeWidth="1" />
            )}
          </g>
        )}

        {/* Capitalist Theme: Tailored Suit, Collar, Silk Tie & Pocket Square */}
        {skin === 'capitalist' && (
          <g id="capitalist-torso-details">
            {/* White Crisp Shirt V */}
            <polygon points="50,71 42,79 58,79" fill="white" />
            {/* Silk Tie */}
            <polygon points="50,72 47,87 53,87" fill="#10B981" />
            <circle cx="50" cy="74" r="1.5" fill="url(#chibi-gold-rich)" />
            {/* Lapels */}
            <path d="M34 72L44 84M66 72L56 84" stroke="url(#chibi-gold-rich)" strokeWidth="1.5" />
            {/* Gold Pocket Watch Chain */}
            <path d="M38 82Q44 87 46 83" stroke="url(#chibi-gold-rich)" strokeWidth="1" fill="none" />
          </g>
        )}

        {/* Cyberpunk Theme: Mecha Exoskeleton & Glowing Power Core */}
        {skin === 'cyberpunk' && (
          <g id="cyber-torso-details">
            {/* Carbon fiber armor plates */}
            <path d="M32 72L50 82L68 72" stroke="#38BDF8" strokeWidth="2" fill="none" />
            {/* Pulsing Arc Reactor Chest Core */}
            <circle cx="50" cy="78" r="5" fill="#0284C7" stroke="#38BDF8" strokeWidth="1.5" />
            <circle cx="50" cy="78" r="2.5" fill="#E0F2FE" className="animate-pulse" />
            <line x1="38" y1="84" x2="62" y2="84" stroke="#F43F5E" strokeWidth="1.5" strokeDasharray="2 2" />
          </g>
        )}

        {/* Corporate Theme: Developer Hoodie & Lanyard */}
        {skin === 'corporate' && (
          <g id="corporate-torso-details">
            {/* Hoodie Zipper */}
            <line x1="50" y1="72" x2="50" y2="88" stroke="#94A3B8" strokeWidth="1.5" />
            {/* Lanyard with Badge */}
            <path d="M44 72L49 83L54 72" stroke="#3B82F6" strokeWidth="1.2" fill="none" />
            <rect x="47" y="82" width="6" height="7" rx="1" fill="white" stroke="#64748B" strokeWidth="0.8" />
          </g>
        )}

        {/* ============================================================== */}
        {/* 3. CHIBI HANDS & HAND-HELD ARTIFACTS / WEAPONS */}
        {/* ============================================================== */}
        {/* Left & Right Cute Puffy Hands */}
        <circle cx="20" cy="78" r="6.5" fill="#FDE2CD" stroke="#E59E75" strokeWidth="1" />
        <circle cx="80" cy="78" r="6.5" fill="#FDE2CD" stroke="#E59E75" strokeWidth="1" />

        {/* SITTING ARTIFACT: Steaming Royal Matcha / Tea Cup */}
        {isSitting && (
          <g id="sitting-tea-artifact">
            <rect x="45" y="73" width="10" height="8" rx="2.5" fill="#F8FAFC" stroke="url(#chibi-gold-rich)" strokeWidth="1" />
            {/* Green matcha tea inside */}
            <ellipse cx="50" cy="74.5" rx="4" ry="1.2" fill="#10B981" />
            {/* Steaming aromatic vapor rising */}
            <path d="M47 71Q49 67 48 63" stroke="#CBD5E1" strokeWidth="1.2" strokeLinecap="round" opacity="0.8" className="animate-pulse" />
            <path d="M52 71Q54 67 53 63" stroke="#CBD5E1" strokeWidth="1.2" strokeLinecap="round" opacity="0.8" className="animate-pulse" />
          </g>
        )}

        {/* RUNNING / ACTIVE ARTIFACTS IN HANDS */}
        {/* Feudal King: Holding Royal Mandate (Thánh Chỉ Hoàng Gia 📜) */}
        {skin === 'feudal' && isPM && (
          <g id="feudal-king-decree" className="animate-pulse">
            <rect x="74" y="58" width="18" height="14" rx="2" fill="#FEF08A" stroke="#B45309" strokeWidth="1.5" />
            <line x1="77" y1="62" x2="88" y2="62" stroke="#DC2626" strokeWidth="1.2" />
            <line x1="77" y1="66" x2="86" y2="66" stroke="#B45309" strokeWidth="1" />
            {/* Red Dragon Seal on decree */}
            <rect x="84" y="61" width="5" height="5" fill="#DC2626" />
            {/* Golden jade roller ends */}
            <circle cx="74" cy="65" r="2.5" fill="url(#chibi-gold-rich)" />
            <circle cx="92" cy="65" r="2.5" fill="url(#chibi-gold-rich)" />
          </g>
        )}

        {/* Feudal Strategist: White Crane Feather Fan (Quạt Bạch Hạc 🪶) */}
        {skin === 'feudal' && isArch && (
          <g id="feudal-fan" className="animate-pulse">
            {/* Layered white feathers */}
            <path d="M78 68Q88 52 83 46Q72 56 76 70Z" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1" />
            <path d="M82 66Q92 52 88 47Q76 58 79 70Z" fill="#F1F5F9" stroke="#CBD5E1" strokeWidth="1" />
            {/* Bamboo fan ribs with golden tassel */}
            <line x1="76" y1="72" x2="84" y2="54" stroke="url(#chibi-gold-rich)" strokeWidth="1.5" />
            <circle cx="76" cy="74" r="2" fill="url(#chibi-jade-rich)" />
            <path d="M76 75Q74 82 73 86" stroke="#DC2626" strokeWidth="1.5" />
          </g>
        )}

        {/* Feudal Treasurer: Ancient Gold Ingot (Kim Nguyên Bảo 🪙) */}
        {skin === 'feudal' && isDB && (
          <g id="feudal-gold-ingot">
            {/* Sycee / Ingot Shape */}
            <path d="M72 74C72 70 88 70 88 74L84 80H76Z" fill="url(#chibi-gold-rich)" stroke="#B45309" strokeWidth="1" />
            <ellipse cx="80" cy="73" rx="6" ry="2.5" fill="#FFE066" />
          </g>
        )}

        {/* Feudal General: Ancient Dragon Dao Sword (Long Đao ⚔️) */}
        {skin === 'feudal' && isBE && (
          <g id="feudal-general-sword" className="animate-pulse">
            {/* Curved Dao Blade */}
            <path d="M78 74L96 52Q93 48 88 52L76 70Z" fill="url(#chibi-steel-rich)" stroke="#475569" strokeWidth="1" />
            {/* Golden Dragon Guard */}
            <ellipse cx="77" cy="72" rx="4" ry="2.5" fill="url(#chibi-gold-rich)" transform="rotate(-35 77 72)" />
            {/* Red hilt ribbon */}
            <line x1="75" y1="75" x2="72" y2="82" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" />
          </g>
        )}

        {/* Feudal Vanguard: Battle Spear with Red Tassel (Hỏa Thương 🚩) */}
        {skin === 'feudal' && isFE && (
          <g id="feudal-vanguard-spear">
            <line x1="74" y1="84" x2="90" y2="40" stroke="#475569" strokeWidth="2" />
            {/* Spearhead */}
            <polygon points="90,40 86,30 94,32" fill="url(#chibi-steel-rich)" stroke="#334155" strokeWidth="0.8" />
            {/* Crimson battle tassel */}
            <circle cx="89" cy="38" r="3" fill="#DC2626" />
          </g>
        )}

        {/* Feudal Censor QA: Jade Law Tablet (Ngọc Bảng Kỷ Cương 📜) */}
        {skin === 'feudal' && isQA && (
          <g id="feudal-censor-tablet">
            <rect x="74" y="64" width="8" height="18" rx="2" fill="url(#chibi-jade-rich)" stroke="url(#chibi-gold-rich)" strokeWidth="1" />
            <line x1="76" y1="68" x2="80" y2="68" stroke="white" strokeWidth="1" />
            <line x1="76" y1="72" x2="80" y2="72" stroke="white" strokeWidth="1" />
          </g>
        )}

        {/* Feudal Shadow Guard: Assassin Kunai Dagger (Ám Khí 🗡️) */}
        {skin === 'feudal' && isSec && (
          <g id="feudal-guard-dagger">
            <polygon points="80,74 88,62 84,60 76,72" fill="url(#chibi-steel-rich)" />
            <circle cx="75" cy="76" r="2" fill="none" stroke="url(#chibi-gold-rich)" strokeWidth="1.2" />
          </g>
        )}

        {/* Capitalist CEO: Cigar with Rising Smoke */}
        {skin === 'capitalist' && isPM && (
          <g id="capitalist-cigar">
            <rect x="58" y="58" width="10" height="3" rx="1" fill="#78350F" stroke="#451A03" strokeWidth="0.5" />
            <circle cx="68" cy="59.5" r="1.5" fill="#EA580C" />
            {/* Curled smoke */}
            <path d="M70 58Q74 54 71 50Q68 46 72 42" stroke="#94A3B8" strokeWidth="1" strokeLinecap="round" fill="none" opacity="0.6" className="animate-pulse" />
          </g>
        )}

        {/* Capitalist CFO: Leather Briefcase with Cash ($) */}
        {skin === 'capitalist' && isDB && (
          <g id="capitalist-briefcase">
            <rect x="72" y="66" width="18" height="14" rx="2" fill="#78350F" stroke="#451A03" strokeWidth="1" />
            <path d="M78 66V63H84V66" stroke="#451A03" strokeWidth="1.2" fill="none" />
            <rect x="79" y="71" width="4" height="3" fill="url(#chibi-gold-rich)" />
            {/* Bursting green cash bills */}
            <rect x="74" y="62" width="6" height="4" rx="0.5" fill="#10B981" />
          </g>
        )}

        {/* ============================================================== */}
        {/* 4. 3D CHIBI SPHERICAL HEAD (Porcelain 3D sphere) */}
        {/* ============================================================== */}
        <circle cx="50" cy="48" r="32" fill={`url(#chibi-head-grad-${skin}-${roleId})`} />
        {/* 3D Glass Specular Spherical Highlight */}
        <circle cx="50" cy="48" r="32" fill="url(#chibi-specular-glass)" />

        {/* Cute Anime Pink Cheek Blush with double dash */}
        <ellipse cx="30" cy="56" rx="5.5" ry="3.5" fill="#F43F5E" opacity="0.35" />
        <line x1="28" y1="55" x2="32" y2="57" stroke="#BE123C" strokeWidth="0.8" opacity="0.5" />
        <ellipse cx="70" cy="56" rx="5.5" ry="3.5" fill="#F43F5E" opacity="0.35" />
        <line x1="68" y1="55" x2="72" y2="57" stroke="#BE123C" strokeWidth="0.8" opacity="0.5" />

        {/* Cute Button Nose Dot */}
        <circle cx="50" cy="53" r="1.2" fill="#E59E75" />

        {/* ============================================================== */}
        {/* 5. HIGH-FIDELITY ANIME EYES & EXPRESSIONS */}
        {/* ============================================================== */}
        {isViolation ? (
          // Shocked / Frantic Violation Eyes (> < or huge alarmed eyes)
          <g id="violation-eyes">
            <ellipse cx="37" cy="47" rx="6.5" ry="7" fill="#1E293B" />
            <ellipse cx="63" cy="47" rx="6.5" ry="7" fill="#1E293B" />
            <circle cx="37" cy="47" r="3" fill="#DC2626" />
            <circle cx="63" cy="47" r="3" fill="#DC2626" />
            {/* Angry sweat drops & furrowed brow */}
            <path d="M31 40L42 43" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M69 40L58 43" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round" />
            {/* Open shocked mouth */}
            <ellipse cx="50" cy="59" rx="4.5" ry="6" fill="#DC2626" stroke="#991B1B" strokeWidth="1" />
          </g>
        ) : isCompleted ? (
          // Joyful Celebrating Winking Eyes (^ ^)
          <g id="cheer-eyes">
            <path d="M30 48Q36 41 42 48" stroke="#0F172A" strokeWidth="3.2" strokeLinecap="round" />
            <path d="M58 48Q64 41 70 48" stroke="#0F172A" strokeWidth="3.2" strokeLinecap="round" />
            {/* Happy open smiling mouth */}
            <path d="M44 56Q50 63 56 56" fill="#F43F5E" stroke="#9F1239" strokeWidth="1.5" />
          </g>
        ) : isSitting ? (
          // Peaceful Meditating / Tea Sipping Eyes (~ ~)
          <g id="sitting-eyes">
            <path d="M31 47Q37 42 43 47" stroke="#1E293B" strokeWidth="2.8" strokeLinecap="round" />
            <path d="M57 47Q63 42 69 47" stroke="#1E293B" strokeWidth="2.8" strokeLinecap="round" />
            <path d="M46 56Q50 59 54 56" stroke="#B45309" strokeWidth="1.8" strokeLinecap="round" />
            <text x="72" y="32" fill="#94A3B8" fontSize="10" fontWeight="bold" opacity="0.85" className="animate-pulse">zZz</text>
          </g>
        ) : (
          // STANDARD GORGEOUS ANIME EYES with 3-Stop Iris & Sparkles
          <g id="anime-standard-eyes">
            {/* Left Eye */}
            <ellipse cx="37" cy="47" rx="5.5" ry="7.5" fill={isPM ? 'url(#chibi-iris-amber)' : 'url(#chibi-iris-sapphire)'} />
            {/* Eyelash lid */}
            <path d="M30 44Q37 39 44 43" stroke="#0F172A" strokeWidth="2.5" strokeLinecap="round" />
            {/* Pupil */}
            <ellipse cx="37" cy="48" rx="3" ry="4" fill="#090D16" />
            {/* Big sparkle highlight */}
            <circle cx="35" cy="43.5" r="2.2" fill="white" />
            {/* Bottom mini highlight */}
            <circle cx="39.5" cy="50" r="1.1" fill="white" />

            {/* Right Eye */}
            <ellipse cx="63" cy="47" rx="5.5" ry="7.5" fill={isPM ? 'url(#chibi-iris-amber)' : 'url(#chibi-iris-sapphire)'} />
            {/* Eyelash lid */}
            <path d="M56 43Q63 39 70 44" stroke="#0F172A" strokeWidth="2.5" strokeLinecap="round" />
            {/* Pupil */}
            <ellipse cx="63" cy="48" rx="3" ry="4" fill="#090D16" />
            {/* Big sparkle highlight */}
            <circle cx="61" cy="43.5" r="2.2" fill="white" />
            {/* Bottom mini highlight */}
            <circle cx="65.5" cy="50" r="1.1" fill="white" />

            {/* Sweet Anime Smile */}
            <path d="M46 56Q50 59.5 54 56" stroke="#B45309" strokeWidth="1.8" strokeLinecap="round" fill="none" />
          </g>
        )}

        {/* ============================================================== */}
        {/* 6. DETAILED ANIME HAIR (Framing cheeks and forehead) */}
        {/* ============================================================== */}
        <g id="anime-hair-bangs">
          {/* Left side lock */}
          <path d="M22 36Q20 54 26 58Q25 46 29 40Z" fill="url(#chibi-hair-raven)" />
          {/* Right side lock */}
          <path d="M78 36Q80 54 74 58Q75 46 71 40Z" fill="url(#chibi-hair-raven)" />
          {/* Front bangs */}
          <path d="M28 34Q38 42 42 36Q46 44 54 36Q62 44 72 34Z" fill="url(#chibi-hair-raven)" />
          {/* Glossy hair highlight arc */}
          <path d="M34 32Q50 28 66 32" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
        </g>

        {/* ============================================================== */}
        {/* 7. THEMED HEADWEAR & ARTIFACT CROWNS */}
        {/* ============================================================== */}

        {/* 👑 TRIỀU ĐÌNH PHONG KIẾN (FEUDAL DYNASTY) */}
        {skin === 'feudal' && (
          <g id="feudal-headwear">
            {/* PM: VUA CHIBI - Hoàng Đế Miện (Imperial Dragon Crown) */}
            {isPM && (
              <g id="imperial-dragon-crown">
                {/* Crown base platform */}
                <rect x="22" y="20" width="56" height="7" rx="3" fill="url(#chibi-gold-rich)" stroke="#B45309" strokeWidth="1" />
                {/* 5-Peak Imperial Spikes */}
                <polygon points="24,20 28,8 34,16 50,4 66,16 72,8 76,20" fill="url(#chibi-gold-rich)" stroke="#92400E" strokeWidth="1" />
                {/* Center Ruby of the Dragon */}
                <circle cx="50" cy="14" r="5" fill="url(#chibi-ruby-rich)" stroke="#FFE066" strokeWidth="1.2" />
                {/* Jade Gems on side peaks */}
                <circle cx="34" cy="14" r="3" fill="url(#chibi-jade-rich)" />
                <circle cx="66" cy="14" r="3" fill="url(#chibi-jade-rich)" />
                {/* Dangling Red Silk Tassels with Gold Beads */}
                <path d="M24 26Q18 40 20 54" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                <circle cx="20" cy="54" r="2.5" fill="url(#chibi-gold-rich)" />
                <path d="M76 26Q82 40 80 54" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                <circle cx="80" cy="54" r="2.5" fill="url(#chibi-gold-rich)" />
              </g>
            )}

            {/* ARCHITECT: QUÂN SƯ - Mũ Cánh Chuồn Thừa Tướng */}
            {isArch && (
              <g id="strategist-wings-cap">
                <ellipse cx="50" cy="18" rx="25" ry="13" fill="url(#chibi-purple-rich)" stroke="#581C87" strokeWidth="1" />
                <rect x="25" y="21" width="50" height="6" rx="2" fill="url(#chibi-gold-rich)" />
                {/* Outstretched Scholar Wings (Mũ Cánh Chuồn) */}
                <ellipse cx="12" cy="19" rx="13" ry="4" fill="url(#chibi-purple-rich)" stroke="url(#chibi-gold-rich)" strokeWidth="1" transform="rotate(-15 12 19)" />
                <ellipse cx="88" cy="19" rx="13" ry="4" fill="url(#chibi-purple-rich)" stroke="url(#chibi-gold-rich)" strokeWidth="1" transform="rotate(15 88 19)" />
                {/* Jade gem in center */}
                <circle cx="50" cy="15" r="3.5" fill="url(#chibi-jade-rich)" stroke="#FEF08A" strokeWidth="1" />
              </g>
            )}

            {/* DATABASE: THỦ KHO - Mũ Quan Hộ Bộ */}
            {isDB && (
              <g id="treasurer-cap">
                <path d="M28 22C28 10 72 10 72 22Z" fill="url(#chibi-jade-rich)" stroke="#064E3B" strokeWidth="1" />
                <rect x="24" y="21" width="52" height="6" rx="2" fill="url(#chibi-gold-rich)" />
                <circle cx="50" cy="12" r="4.5" fill="url(#chibi-gold-rich)" />
              </g>
            )}

            {/* BACKEND: ĐẠI TƯỚNG QUÂN - Mũ Thiết Giáp & Ngù Cờ Đỏ */}
            {isBE && (
              <g id="general-helmet">
                {/* Steel Helmet Shell */}
                <path d="M24 24C24 9 76 9 76 24Z" fill="url(#chibi-steel-rich)" stroke="#1E293B" strokeWidth="1.2" />
                {/* Golden Crest Peak */}
                <polygon points="50,2 45,9 55,9" fill="url(#chibi-gold-rich)" />
                {/* Flowing Crimson Battle Plume */}
                <path d="M50 4Q65 -2 75 8Q68 12 52 7" fill="url(#chibi-crimson-rich)" />
                {/* Brow Plate */}
                <rect x="22" y="21" width="56" height="5" rx="1.5" fill="url(#chibi-gold-rich)" />
                {/* Tiger Face Crest */}
                <circle cx="50" cy="23.5" r="3" fill="#DC2626" stroke="#FEF08A" strokeWidth="1" />
              </g>
            )}

            {/* FRONTEND: TIÊN PHONG TƯỚNG QUÂN - Dải Băng Tiên Phong */}
            {isFE && (
              <g id="vanguard-headband">
                {/* Crimson battle headband */}
                <path d="M22 22H78V28H22Z" fill="url(#chibi-crimson-rich)" stroke="#9F1239" strokeWidth="1" />
                {/* Golden badge */}
                <circle cx="24" cy="25" r="4" fill="url(#chibi-gold-rich)" />
                {/* Trailing silk ribbon */}
                <path d="M22 26Q10 38 8 52" stroke="#E11D48" strokeWidth="3.5" strokeLinecap="round" />
              </g>
            )}

            {/* QA: NGỰ SỬ ĐÀI - Mũ Pháp Quan Kỷ Cương */}
            {isQA && (
              <g id="censor-cap">
                <path d="M30 23L36 9H64L70 23Z" fill="#14532D" stroke="#052E16" strokeWidth="1" />
                <rect x="26" y="21" width="48" height="5" rx="1.5" fill="url(#chibi-gold-rich)" />
                <circle cx="50" cy="14" r="3.5" fill="url(#chibi-gold-rich)" />
              </g>
            )}

            {/* SECURITY: CẨM Y VỆ - Nón Rơm Mật Thám & Khăn Đỏ */}
            {isSec && (
              <g id="assassin-hat">
                {/* Conical Bamboo Shadow Hat */}
                <polygon points="50,4 12,27 88,27" fill="#1E293B" stroke="#475569" strokeWidth="1.2" />
                <circle cx="50" cy="4" r="3" fill="url(#chibi-crimson-rich)" />
                {/* Shadow Veil covering upper face */}
                <path d="M22 27H78V35H22Z" fill="#090D16" opacity="0.6" />
                {/* Glowing piercing red assassin eye in shadow */}
                <circle cx="63" cy="38" r="2.5" fill="#EF4444" className="animate-ping" />
              </g>
            )}
          </g>
        )}

        {/* 💼 TƯ BẢN PHỐ WALL (WALL STREET CAPITALISTS) */}
        {skin === 'capitalist' && (
          <g id="capitalist-headwear">
            {/* CEO: High Silk Top Hat with Gold Band */}
            {isPM && (
              <g id="ceo-top-hat">
                <ellipse cx="50" cy="23" rx="35" ry="8" fill="#090D16" stroke="#334155" strokeWidth="1" />
                <rect x="28" y="2" width="44" height="21" rx="3" fill="#0F172A" />
                <rect x="28" y="17" width="44" height="6" fill="url(#chibi-gold-rich)" />
                {/* Golden Monocle with chain */}
                <circle cx="63" cy="47" r="8.5" fill="none" stroke="url(#chibi-gold-rich)" strokeWidth="2" />
                <path d="M71 49Q78 56 82 68" stroke="url(#chibi-gold-rich)" strokeWidth="1.2" strokeDasharray="2 1" fill="none" />
              </g>
            )}

            {/* CSO: Designer Glasses & Bluetooth Headset */}
            {isArch && (
              <g id="cso-specs">
                <rect x="27" y="42" width="18" height="11" rx="3" fill="#38BDF8" fillOpacity="0.3" stroke="#0F172A" strokeWidth="2" />
                <rect x="55" y="42" width="18" height="11" rx="3" fill="#38BDF8" fillOpacity="0.3" stroke="#0F172A" strokeWidth="2" />
                <line x1="45" y1="47" x2="55" y2="47" stroke="#0F172A" strokeWidth="2" />
              </g>
            )}

            {/* CFO: Banker Visor & Tie */}
            {isDB && (
              <g id="cfo-visor">
                <path d="M22 24C22 14 78 14 78 24Z" fill="#047857" />
                <rect x="20" y="22" width="60" height="5" rx="2" fill="url(#chibi-gold-rich)" />
              </g>
            )}

            {/* COO: Dual Trading Audio Headset */}
            {isBE && (
              <g id="quant-headset">
                <path d="M18 45C18 18 82 18 82 45" stroke="#475569" strokeWidth="4.5" fill="none" />
                <rect x="14" y="41" width="8" height="16" rx="4" fill="#0284C7" stroke="white" strokeWidth="1" />
                <rect x="78" y="41" width="8" height="16" rx="4" fill="#0284C7" stroke="white" strokeWidth="1" />
                {/* Boom mic */}
                <path d="M20 54Q30 62 42 60" stroke="#0284C7" strokeWidth="2" fill="none" />
                <circle cx="43" cy="60" r="2.5" fill="#EF4444" />
              </g>
            )}

            {/* CMO: Luxury Gradient Sunglasses */}
            {isFE && (
              <g id="cmo-shades">
                <polygon points="26,42 46,42 44,55 30,55" fill="#090D16" />
                <polygon points="54,42 74,42 70,55 56,55" fill="#090D16" />
                <line x1="46" y1="46" x2="54" y2="46" stroke="url(#chibi-gold-rich)" strokeWidth="2" />
              </g>
            )}
          </g>
        )}

        {/* 🚀 CHIẾN BINH CYBERPUNK 2077 */}
        {skin === 'cyberpunk' && (
          <g id="cyberpunk-headgear">
            {/* Holographic Glowing Visor */}
            <path d="M24 40H76V53H24Z" rx="4" fill="#0284C7" fillOpacity="0.45" stroke="#38BDF8" strokeWidth="2" />
            <line x1="26" y1="46" x2="74" y2="46" stroke="#F43F5E" strokeWidth="1.5" strokeDasharray="3 2" />
            {/* Cyber Antennae */}
            <line x1="22" y1="26" x2="14" y2="12" stroke="#38BDF8" strokeWidth="3" strokeLinecap="round" />
            <circle cx="13" cy="11" r="3" fill="#E879F9" />
            <line x1="78" y1="26" x2="86" y2="12" stroke="#38BDF8" strokeWidth="3" strokeLinecap="round" />
            <circle cx="87" cy="11" r="3" fill="#E879F9" />
          </g>
        )}

        {/* 🏢 CÔNG TY CÔNG NGHỆ HIỆN ĐẠI (CORPORATE) */}
        {skin === 'corporate' && (
          <g id="corporate-hair-gear">
            {/* Modern Stylized Hair */}
            <path d="M22 36C22 16 78 16 78 36Z" fill="#1E293B" />
            {isArch && (
              <g id="corp-glasses">
                <circle cx="37" cy="47" r="7.5" fill="none" stroke="#64748B" strokeWidth="2" />
                <circle cx="63" cy="47" r="7.5" fill="none" stroke="#64748B" strokeWidth="2" />
                <line x1="44.5" y1="47" x2="55.5" y2="47" stroke="#64748B" strokeWidth="1.8" />
              </g>
            )}
          </g>
        )}

        {/* ============================================================== */}
        {/* 8. OVERLAY STATUS BADGE (Ping for Violation, Check for Done) */}
        {/* ============================================================== */}
        {isViolation && (
          <g className="animate-ping origin-center">
            <circle cx="83" cy="17" r="10" fill="#DC2626" />
            <text x="80" y="22" fill="white" fontSize="15" fontWeight="bold">!</text>
          </g>
        )}

        {isCompleted && (
          <g>
            <circle cx="82" cy="19" r="8" fill="#10B981" stroke="white" strokeWidth="1.5" />
            <path d="M78 19L81 22L86 16" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        )}
      </svg>
    </div>
  );
};
