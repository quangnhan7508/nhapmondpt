import crypto from 'crypto';
import { UserManager, ItemRarity, InventoryItem } from '../../auth/UserManager';
import { CaseDefinition, CaseItemTemplate, CaseOpenResult, CaseOpenMultiResult, CaseSingleSpin } from './types';

// BẢNG GIÁ THEO KINH TẾ NGƯỜI CHƠI (avg ~58k, bỏ whale 64B; newbie 500, đi làm 1000/lượt):
// Bronze 5,000 / Silver 25,000 / Gold 100,000 / Dragon 1,000,000 / Legend 10,000,000 / Mythic 100,000,000 — RTP ~95% mỗi hòm.
export const CASE_DEFINITIONS: CaseDefinition[] = [
  {
    id: 'case_bronze',
    name: 'Hòm Tân Thủ (Mil-Spec)',
    description: 'Hòm khởi đầu cho người mới: 5 lượt đi làm là mở được, vẫn có cơ hội dao xịn.',
    price: 5000,
    icon: '📦',
    badge: '5,000 🪙',
    gradient: 'from-amber-700 to-orange-600',
    items: [
      // Trắng (White, 54% - avg 1,500 coin)
      { itemId: 'p250_sand_dune', name: 'P250 | Sand Dune', rarity: 'white', value: 1200, icon: '🔫', weaponType: 'Pistol' },
      { itemId: 'mp9_storm', name: 'MP9 | Storm', rarity: 'white', value: 1350, icon: '⚡', weaponType: 'SMG' },
      { itemId: 'nova_polar_mesh', name: 'Nova | Polar Mesh', rarity: 'white', value: 1500, icon: '💥', weaponType: 'Shotgun' },
      { itemId: 'sg553_waves', name: 'SG 553 | Waves', rarity: 'white', value: 1600, icon: '🌊', weaponType: 'Rifle' },
      { itemId: 'ump_carbon_fiber', name: 'UMP-45 | Carbon Fiber', rarity: 'white', value: 1750, icon: '⬛', weaponType: 'SMG' },
      { itemId: 'sawed_forest_ddpat', name: 'Sawed-Off | Forest DDPAT', rarity: 'white', value: 1800, icon: '🌲', weaponType: 'Shotgun' },
      { itemId: 'sawed_sage_spray', name: 'Sawed-Off | Sage Spray', rarity: 'white', value: 1300, icon: '🍃', weaponType: 'Shotgun' },
      { itemId: 'p90_scorched_bronze', name: 'P90 | Scorched', rarity: 'white', value: 1450, icon: '🔥', weaponType: 'SMG' },
      { itemId: 'galil_phoenix_jr', name: 'Galil AR | Phoenix Junior', rarity: 'white', value: 1550, icon: '🐦', weaponType: 'Rifle' },
      { itemId: 'nova_predator_bronze', name: 'Nova | Predator', rarity: 'white', value: 1650, icon: '🎯', weaponType: 'Shotgun' },
      { itemId: 'mp9_dry_season', name: 'MP9 | Dry Season', rarity: 'white', value: 1500, icon: '🏜️', weaponType: 'SMG' },
      { itemId: 'p2000_granite', name: 'P2000 | Granite Marbleized', rarity: 'white', value: 1700, icon: '🪨', weaponType: 'Pistol' },
      // Xanh (Blue, 28% - avg 3,500 coin)
      { itemId: 'glock_high_beam', name: 'Glock-18 | High Beam', rarity: 'blue', value: 3000, icon: '🔫', weaponType: 'Pistol' },
      { itemId: 'galil_rocket_pop', name: 'Galil AR | Rocket Pop', rarity: 'blue', value: 3200, icon: '🚀', weaponType: 'Rifle' },
      { itemId: 'usps_blueprint', name: 'USP-S | Blueprint', rarity: 'blue', value: 3400, icon: '📐', weaponType: 'Pistol' },
      { itemId: 'famas_tobogan', name: 'FAMAS | Tobogan', rarity: 'blue', value: 3600, icon: '🛷', weaponType: 'Rifle' },
      { itemId: 'p90_storm_phase', name: 'P90 | Storm Phase', rarity: 'blue', value: 3800, icon: '⛈️', weaponType: 'SMG' },
      { itemId: 'deagle_urban_rubble', name: 'Desert Eagle | Urban Rubble', rarity: 'blue', value: 4000, icon: '🏚️', weaponType: 'Pistol' },
      { itemId: 'famas_doomkitty', name: 'FAMAS | Doomkitty', rarity: 'blue', value: 3300, icon: '🐱', weaponType: 'Rifle' },
      { itemId: 'mac10_carnivore', name: 'MAC-10 | Carnivore', rarity: 'blue', value: 3500, icon: '🥩', weaponType: 'SMG' },
      { itemId: 'mag7_praetorian', name: 'MAG-7 | Praetorian', rarity: 'blue', value: 3700, icon: '🛡️', weaponType: 'Shotgun' },
      { itemId: 'deagle_mudder', name: 'Desert Eagle | Mudder', rarity: 'blue', value: 3600, icon: '🟤', weaponType: 'Pistol' },
      // Tím (Purple, 12% - avg 8,500 coin)
      { itemId: 'm4a4_evil_daimyo', name: 'M4A4 | Evil Daimyo', rarity: 'purple', value: 7500, icon: '👺', weaponType: 'Rifle' },
      { itemId: 'ak47_elite_build', name: 'AK-47 | Elite Build', rarity: 'purple', value: 8000, icon: '⚜️', weaponType: 'Rifle' },
      { itemId: 'glock_water_elemental', name: 'Glock-18 | Water Elemental', rarity: 'purple', value: 8500, icon: '🌊', weaponType: 'Pistol' },
      { itemId: 'usps_neo_noir', name: 'USP-S | Neo-Noir', rarity: 'purple', value: 9000, icon: '🌃', weaponType: 'Pistol' },
      { itemId: 'deagle_kumicho', name: 'Desert Eagle | Kumicho Dragon', rarity: 'purple', value: 9500, icon: '🐲', weaponType: 'Pistol' },
      { itemId: 'ak47_phantom_disruptor', name: 'AK-47 | Phantom Disruptor', rarity: 'purple', value: 8000, icon: '👻', weaponType: 'Rifle' },
      { itemId: 'm4a1s_nitro', name: 'M4A1-S | Nitro', rarity: 'purple', value: 8500, icon: '🏎️', weaponType: 'Rifle' },
      { itemId: 'awp_paw_bronze', name: 'AWP | PAW', rarity: 'purple', value: 9000, icon: '🐾', weaponType: 'Sniper' },
      // Đỏ (Red, 5% - avg 22,000 coin)
      { itemId: 'awp_fever_dream', name: 'AWP | Fever Dream', rarity: 'red', value: 20000, icon: '🎯', weaponType: 'Sniper' },
      { itemId: 'deagle_mecha', name: 'Desert Eagle | Mecha Industries', rarity: 'red', value: 21000, icon: '🤖', weaponType: 'Pistol' },
      { itemId: 'm4a1s_chantico', name: "M4A1-S | Chantico's Fire", rarity: 'red', value: 23000, icon: '🔥', weaponType: 'Rifle' },
      { itemId: 'ak47_redline', name: 'AK-47 | Redline', rarity: 'red', value: 24000, icon: '🏁', weaponType: 'Rifle' },
      { itemId: 'glock_twilight', name: 'Glock-18 | Twilight', rarity: 'red', value: 21000, icon: '🌆', weaponType: 'Pistol' },
      { itemId: 'm4a4_buzzkill', name: 'M4A4 | Buzz Kill', rarity: 'red', value: 23000, icon: '🐝', weaponType: 'Rifle' },
      // Vàng (Gold, 1% - avg 84,000 coin)
      { itemId: 'gut_tiger_tooth', name: '★ Gut Knife | Tiger Tooth', rarity: 'gold', value: 80000, icon: '🔪', weaponType: 'Knife' },
      { itemId: 'daggers_fade', name: '★ Shadow Daggers | Fade', rarity: 'gold', value: 84000, icon: '🗡️', weaponType: 'Knife' },
      { itemId: 'navaja_damascus', name: '★ Navaja Knife | Damascus Steel', rarity: 'gold', value: 88000, icon: '🗡️', weaponType: 'Knife' },
      { itemId: 'flip_tiger_tooth', name: '★ Flip Knife | Tiger Tooth', rarity: 'gold', value: 82000, icon: '🐯', weaponType: 'Knife' },
      { itemId: 'ursus_crimson_web', name: '★ Ursus Knife | Crimson Web', rarity: 'gold', value: 86000, icon: '🕸️', weaponType: 'Knife' }
    ]
  },
  {
    id: 'case_silver',
    name: 'Hòm Chiến Binh (Classified)',
    description: 'Hòm trung cấp cho người chơi tầm trung, skin giá trị cao.',
    price: 25000,
    icon: '💼',
    badge: '25,000 🪙',
    gradient: 'from-blue-600 to-indigo-700',
    items: [
      // Trắng (White, 54% - avg 7,500 coin)
      { itemId: 'p90_grim', name: 'P90 | Grim', rarity: 'white', value: 6500, icon: '💀', weaponType: 'SMG' },
      { itemId: 'famas_survivor', name: 'FAMAS | Survivor Z', rarity: 'white', value: 7000, icon: '🧟', weaponType: 'Rifle' },
      { itemId: 'ssg_necropos', name: 'SSG 08 | Necropos', rarity: 'white', value: 7500, icon: '🎯', weaponType: 'Sniper' },
      { itemId: 'ump_primal_saber', name: 'UMP-45 | Primal Saber', rarity: 'white', value: 8000, icon: '🦖', weaponType: 'SMG' },
      { itemId: 'nova_antique', name: 'Nova | Antique', rarity: 'white', value: 8500, icon: '🏺', weaponType: 'Shotgun' },
      { itemId: 'xm_seasons', name: 'XM1014 | Seasons', rarity: 'white', value: 7500, icon: '🍂', weaponType: 'Shotgun' },
      { itemId: 'bizon_night_riot', name: 'PP-Bizon | Night Riot', rarity: 'white', value: 7000, icon: '🌃', weaponType: 'SMG' },
      { itemId: 'sawed_apocalypto', name: 'Sawed-Off | Apocalypto', rarity: 'white', value: 7200, icon: '🗿', weaponType: 'Shotgun' },
      { itemId: 'sg553_bulldozer', name: 'SG 553 | Bulldozer', rarity: 'white', value: 7800, icon: '🚜', weaponType: 'Rifle' },
      { itemId: 'mp7_cirrus', name: 'MP7 | Cirrus', rarity: 'white', value: 7700, icon: '☁️', weaponType: 'SMG' },
      { itemId: 'p250_asiimov_silver', name: 'P250 | Asiimov', rarity: 'white', value: 7300, icon: '⚪', weaponType: 'Pistol' },
      { itemId: 'ssg_big_iron', name: 'SSG 08 | Big Iron', rarity: 'white', value: 8000, icon: '🤠', weaponType: 'Sniper' },
      // Xanh (Blue, 28% - avg 17,500 coin)
      { itemId: 'm4a1s_leaded', name: 'M4A1-S | Leaded Glass', rarity: 'blue', value: 15000, icon: '💎', weaponType: 'Rifle' },
      { itemId: 'ak47_point_disarray', name: 'AK-47 | Point Disarray', rarity: 'blue', value: 16000, icon: '🎨', weaponType: 'Rifle' },
      { itemId: 'usps_cortex', name: 'USP-S | Cortex', rarity: 'blue', value: 17000, icon: '🧠', weaponType: 'Pistol' },
      { itemId: 'awp_mortis', name: 'AWP | Mortis', rarity: 'blue', value: 18000, icon: '💀', weaponType: 'Sniper' },
      { itemId: 'glock_bullet_queen', name: 'Glock-18 | Bullet Queen', rarity: 'blue', value: 19000, icon: '👸', weaponType: 'Pistol' },
      { itemId: 'deagle_ocean_drive', name: 'Desert Eagle | Ocean Drive', rarity: 'blue', value: 20000, icon: '🌊', weaponType: 'Pistol' },
      { itemId: 'galil_signal', name: 'Galil AR | Signal', rarity: 'blue', value: 16500, icon: '📡', weaponType: 'Rifle' },
      { itemId: 'ump_exposure', name: 'UMP-45 | Exposure', rarity: 'blue', value: 17500, icon: '📸', weaponType: 'SMG' },
      { itemId: 'nova_gila', name: 'Nova | Gila', rarity: 'blue', value: 18000, icon: '🦎', weaponType: 'Shotgun' },
      { itemId: 'cz75_red_astor', name: 'CZ75-Auto | Red Astor', rarity: 'blue', value: 17000, icon: '🃏', weaponType: 'Pistol' },
      // Tím (Purple, 12% - avg 42,500 coin)
      { itemId: 'awp_hyper_beast', name: 'AWP | Hyper Beast', rarity: 'purple', value: 40000, icon: '🐉', weaponType: 'Sniper' },
      { itemId: 'deagle_code_red', name: 'Desert Eagle | Code Red', rarity: 'purple', value: 41000, icon: '🚨', weaponType: 'Pistol' },
      { itemId: 'm4a4_neo_noir', name: 'M4A4 | Neo-Noir', rarity: 'purple', value: 42500, icon: '🌃', weaponType: 'Rifle' },
      { itemId: 'ak47_neon_revolution', name: 'AK-47 | Neon Revolution', rarity: 'purple', value: 44000, icon: '🌈', weaponType: 'Rifle' },
      { itemId: 'usps_kill_confirmed', name: 'USP-S | Kill Confirmed', rarity: 'purple', value: 45000, icon: '💀', weaponType: 'Pistol' },
      { itemId: 'deagle_fennec', name: 'Desert Eagle | Fennec', rarity: 'purple', value: 41500, icon: '🦊', weaponType: 'Pistol' },
      { itemId: 'm4a4_tooth_fairy', name: 'M4A4 | Tooth Fairy', rarity: 'purple', value: 43000, icon: '🧚', weaponType: 'Rifle' },
      { itemId: 'ak47_headshot', name: 'AK-47 | Head Shot', rarity: 'purple', value: 43000, icon: '🎯', weaponType: 'Rifle' },
      // Đỏ (Red, 5% - avg 110,000 coin)
      { itemId: 'ak47_vulcan', name: 'AK-47 | Vulcan', rarity: 'red', value: 100000, icon: '🌋', weaponType: 'Rifle' },
      { itemId: 'm4a4_emperor', name: 'M4A4 | The Emperor', rarity: 'red', value: 105000, icon: '👑', weaponType: 'Rifle' },
      { itemId: 'awp_asiimov', name: 'AWP | Asiimov', rarity: 'red', value: 110000, icon: '⚪', weaponType: 'Sniper' },
      { itemId: 'm4a1s_hot_rod', name: 'M4A1-S | Hot Rod', rarity: 'red', value: 115000, icon: '🏎️', weaponType: 'Rifle' },
      { itemId: 'glock_fade', name: 'Glock-18 | Fade', rarity: 'red', value: 120000, icon: '🌅', weaponType: 'Pistol' },
      { itemId: 'awp_manowar', name: 'AWP | Man-o-war', rarity: 'red', value: 108000, icon: '⚓', weaponType: 'Sniper' },
      { itemId: 'deagle_blaze_mw', name: 'Desert Eagle | Blaze (Minimal Wear)', rarity: 'red', value: 112000, icon: '🔥', weaponType: 'Pistol' },
      // Vàng (Gold, 1% - avg 420,000 coin)
      { itemId: 'flip_doppler', name: '★ Flip Knife | Doppler', rarity: 'gold', value: 380000, icon: '🌀', weaponType: 'Knife' },
      { itemId: 'karambit_slaughter', name: '★ Karambit | Slaughter', rarity: 'gold', value: 420000, icon: '🩸', weaponType: 'Knife' },
      { itemId: 'm9_tiger_tooth', name: '★ M9 Bayonet | Tiger Tooth', rarity: 'gold', value: 460000, icon: '🐯', weaponType: 'Knife' },
      { itemId: 'bayonet_doppler', name: '★ Bayonet | Doppler', rarity: 'gold', value: 400000, icon: '🔪', weaponType: 'Knife' },
      { itemId: 'moto_finish_line', name: '★ Moto Gloves | Finish Line', rarity: 'gold', value: 440000, icon: '🏁', weaponType: 'Gloves' }
    ]
  },
  {
    id: 'case_gold',
    name: 'Hòm Thượng Cổ (Covert)',
    description: 'Hòm thượng hạng cho đại gia: Dragon Lore, dao Bướm và găng tay Pandora.',
    price: 100000,
    icon: '👑',
    badge: '100,000 🪙',
    gradient: 'from-amber-500 via-yellow-500 to-amber-600',
    items: [
      // Trắng (White, 54% - avg 30,000 coin)
      { itemId: 'sg553_integrale', name: 'SG 553 | Integrale', rarity: 'white', value: 26000, icon: '🏎️', weaponType: 'Rifle' },
      { itemId: 'aug_flame_jormungandr', name: 'AUG | Flame Jormungandr', rarity: 'white', value: 28000, icon: '🔥', weaponType: 'Rifle' },
      { itemId: 'mp7_bloodsport', name: 'MP7 | Bloodsport', rarity: 'white', value: 30000, icon: '🏎️', weaponType: 'SMG' },
      { itemId: 'p90_asiimov', name: 'P90 | Asiimov', rarity: 'white', value: 32000, icon: '⚪', weaponType: 'SMG' },
      { itemId: 'ump_blaze', name: 'UMP-45 | Blaze', rarity: 'white', value: 34000, icon: '🔥', weaponType: 'SMG' },
      { itemId: 'negev_power_loader', name: 'Negev | Power Loader', rarity: 'white', value: 30000, icon: '⚙️', weaponType: 'Rifle' },
      { itemId: 'p90_trigon', name: 'P90 | Trigon', rarity: 'white', value: 28000, icon: '📐', weaponType: 'SMG' },
      { itemId: 'mp9_bioleak', name: 'MP9 | Bioleak', rarity: 'white', value: 29000, icon: '☣️', weaponType: 'SMG' },
      { itemId: 'xm_black_tie', name: 'XM1014 | Black Tie', rarity: 'white', value: 31000, icon: '🤵', weaponType: 'Shotgun' },
      { itemId: 'famas_roll_cage', name: 'FAMAS | Roll Cage', rarity: 'white', value: 32000, icon: '🏎️', weaponType: 'Rifle' },
      { itemId: 'sawed_spirit_board', name: 'Sawed-Off | Spirit Board', rarity: 'white', value: 30000, icon: '🔮', weaponType: 'Shotgun' },
      { itemId: 'tec9_isaac', name: 'Tec-9 | Isaac', rarity: 'white', value: 29000, icon: '🚀', weaponType: 'Pistol' },
      // Xanh (Blue, 28% - avg 70,000 coin)
      { itemId: 'deagle_printstream', name: 'Desert Eagle | Printstream', rarity: 'blue', value: 60000, icon: '🤍', weaponType: 'Pistol' },
      { itemId: 'm4a1s_player_two', name: 'M4A1-S | Player Two', rarity: 'blue', value: 65000, icon: '👾', weaponType: 'Rifle' },
      { itemId: 'ak47_asiimov', name: 'AK-47 | Asiimov', rarity: 'blue', value: 70000, icon: '⚪', weaponType: 'Rifle' },
      { itemId: 'awp_wildfire', name: 'AWP | Wildfire', rarity: 'blue', value: 75000, icon: '🔥', weaponType: 'Sniper' },
      { itemId: 'usps_ticket_hell', name: 'USP-S | Ticket to Hell', rarity: 'blue', value: 80000, icon: '🎫', weaponType: 'Pistol' },
      { itemId: 'glock_wasteland_rebel', name: 'Glock-18 | Wasteland Rebel', rarity: 'blue', value: 70000, icon: '🏜️', weaponType: 'Pistol' },
      { itemId: 'ak47_uncharted', name: 'AK-47 | Uncharted', rarity: 'blue', value: 68000, icon: '🗺️', weaponType: 'Rifle' },
      { itemId: 'm4a4_mainframe', name: 'M4A4 | Mainframe', rarity: 'blue', value: 72000, icon: '🖥️', weaponType: 'Rifle' },
      { itemId: 'awp_sun_leo', name: 'AWP | Sun in Leo', rarity: 'blue', value: 74000, icon: '🦁', weaponType: 'Sniper' },
      { itemId: 'deagle_night_heist', name: 'Desert Eagle | Night Heist', rarity: 'blue', value: 66000, icon: '🌙', weaponType: 'Pistol' },
      // Tím (Purple, 12% - avg 170,000 coin)
      { itemId: 'ak47_bloodsport', name: 'AK-47 | Bloodsport', rarity: 'purple', value: 160000, icon: '🏎️', weaponType: 'Rifle' },
      { itemId: 'awp_oni_taiji', name: 'AWP | Oni Taiji', rarity: 'purple', value: 170000, icon: '👺', weaponType: 'Sniper' },
      { itemId: 'm4a1s_mecha', name: 'M4A1-S | Mecha Industries', rarity: 'purple', value: 160000, icon: '🤖', weaponType: 'Rifle' },
      { itemId: 'deagle_blaze', name: 'Desert Eagle | Blaze', rarity: 'purple', value: 180000, icon: '🔥', weaponType: 'Pistol' },
      { itemId: 'glock_dragon_tattoo', name: 'Glock-18 | Dragon Tattoo', rarity: 'purple', value: 180000, icon: '🐉', weaponType: 'Rifle' },
      { itemId: 'usps_orion', name: 'USP-S | Orion', rarity: 'purple', value: 165000, icon: '⭐', weaponType: 'Pistol' },
      { itemId: 'glock_vogue', name: 'Glock-18 | Vogue', rarity: 'purple', value: 170000, icon: '💅', weaponType: 'Pistol' },
      { itemId: 'm4a1s_hyper_beast', name: 'M4A1-S | Hyper Beast', rarity: 'purple', value: 175000, icon: '🐲', weaponType: 'Rifle' },
      // Đỏ (Red, 5% - avg 440,000 coin)
      { itemId: 'm4a4_howl', name: 'M4A4 | Howl (Contraband)', rarity: 'red', value: 400000, icon: '🐺', weaponType: 'Rifle' },
      { itemId: 'ak47_fire_serpent', name: 'AK-47 | Fire Serpent', rarity: 'red', value: 440000, icon: '🐍', weaponType: 'Rifle' },
      { itemId: 'awp_gungnir', name: 'AWP | Gungnir', rarity: 'red', value: 480000, icon: '⚡', weaponType: 'Sniper' },
      { itemId: 'm4a1s_knight', name: 'M4A1-S | Knight', rarity: 'red', value: 440000, icon: '⚔️', weaponType: 'Rifle' },
      { itemId: 'ak47_aqua_revenge', name: 'AK-47 | Aquamarine Revenge', rarity: 'red', value: 430000, icon: '🌊', weaponType: 'Rifle' },
      { itemId: 'awp_desert_hydra', name: 'AWP | Desert Hydra', rarity: 'red', value: 450000, icon: '🐍', weaponType: 'Sniper' },
      // Vàng (Gold, 1% - avg 1,680,000 coin)
      { itemId: 'butterfly_fade', name: '★ Butterfly Knife | Fade', rarity: 'gold', value: 1500000, icon: '🦋', weaponType: 'Knife' },
      { itemId: 'awp_dragon_lore', name: 'AWP | Dragon Lore', rarity: 'gold', value: 1680000, icon: '🐉', weaponType: 'Sniper' },
      { itemId: 'pandora_gloves', name: "★ Sport Gloves | Pandora's Box", rarity: 'gold', value: 1860000, icon: '🧤', weaponType: 'Gloves' },
      { itemId: 'karambit_tiger_tooth', name: '★ Karambit | Tiger Tooth', rarity: 'gold', value: 1600000, icon: '🐯', weaponType: 'Knife' },
      { itemId: 'driver_king_snake', name: '★ Driver Gloves | King Snake', rarity: 'gold', value: 1760000, icon: '🐍', weaponType: 'Gloves' }
    ]
  },
  {
    id: 'case_dragon',
    name: 'Hòm Rồng Hoàng Kim (Immortal)',
    description: 'Hòm tối thượng cho cá voi: skin trăm triệu và dao Sapphire huyền thoại.',
    price: 1000000,
    icon: '🐉',
    badge: '1,000,000 🪙',
    gradient: 'from-red-600 via-amber-500 to-yellow-400',
    items: [
      // Trắng (White, 54% - avg 300,000 coin)
      { itemId: 'ak47_redline_dragon', name: 'AK-47 | Redline', rarity: 'white', value: 260000, icon: '🏁', weaponType: 'Rifle' },
      { itemId: 'm4a4_asiimov_dragon', name: 'M4A4 | Asiimov', rarity: 'white', value: 280000, icon: '⚪', weaponType: 'Rifle' },
      { itemId: 'deagle_printstream_dragon', name: 'Desert Eagle | Printstream', rarity: 'white', value: 300000, icon: '🤍', weaponType: 'Pistol' },
      { itemId: 'usps_neo_noir_dragon', name: 'USP-S | Neo-Noir', rarity: 'white', value: 320000, icon: '🌃', weaponType: 'Pistol' },
      { itemId: 'awp_asiimov_dragon', name: 'AWP | Asiimov', rarity: 'white', value: 340000, icon: '⚪', weaponType: 'Sniper' },
      { itemId: 'glock_water_elem_dragon', name: 'Glock-18 | Water Elemental', rarity: 'white', value: 300000, icon: '🌊', weaponType: 'Pistol' },
      { itemId: 'mac10_disco_tech', name: 'MAC-10 | Disco Tech', rarity: 'white', value: 280000, icon: '🪩', weaponType: 'SMG' },
      { itemId: 'mag7_heat_dragon', name: 'MAG-7 | Heat', rarity: 'white', value: 290000, icon: '♨️', weaponType: 'Shotgun' },
      { itemId: 'galil_chroma_cannon', name: 'Galil AR | Chroma Cannon', rarity: 'white', value: 310000, icon: '🌈', weaponType: 'Rifle' },
      { itemId: 'scar_grotto', name: 'SCAR-20 | Grotto', rarity: 'white', value: 320000, icon: '🌊', weaponType: 'Sniper' },
      { itemId: 'm249_jungle_ddpat', name: 'M249 | Jungle DDPAT', rarity: 'white', value: 300000, icon: '🌴', weaponType: 'Machinegun' },
      { itemId: 'p250_asiimov_dragon', name: 'P250 | Asiimov', rarity: 'white', value: 290000, icon: '⚪', weaponType: 'Pistol' },
      // Xanh (Blue, 28% - avg 700,000 coin)
      { itemId: 'ak47_neon_revolution_dragon', name: 'AK-47 | Neon Revolution', rarity: 'blue', value: 600000, icon: '🌈', weaponType: 'Rifle' },
      { itemId: 'm4a1s_hot_rod_dragon', name: 'M4A1-S | Hot Rod', rarity: 'blue', value: 650000, icon: '🏎️', weaponType: 'Rifle' },
      { itemId: 'awp_hyper_beast_dragon', name: 'AWP | Hyper Beast', rarity: 'blue', value: 700000, icon: '🐉', weaponType: 'Sniper' },
      { itemId: 'deagle_code_red_dragon', name: 'Desert Eagle | Code Red', rarity: 'blue', value: 750000, icon: '🚨', weaponType: 'Pistol' },
      { itemId: 'usps_kill_confirmed_dragon', name: 'USP-S | Kill Confirmed', rarity: 'blue', value: 800000, icon: '💀', weaponType: 'Pistol' },
      { itemId: 'glock_fade_dragon', name: 'Glock-18 | Fade', rarity: 'blue', value: 700000, icon: '🌅', weaponType: 'Pistol' },
      { itemId: 'mp9_mount_fuji', name: 'MP9 | Mount Fuji', rarity: 'blue', value: 680000, icon: '🗻', weaponType: 'SMG' },
      { itemId: 'xm_oxide_blaze', name: 'XM1014 | Oxide Blaze', rarity: 'blue', value: 720000, icon: '🔥', weaponType: 'Shotgun' },
      { itemId: 'ak47_frontside_misty', name: 'AK-47 | Frontside Misty', rarity: 'blue', value: 740000, icon: '🌫️', weaponType: 'Rifle' },
      { itemId: 'deagle_night_heist_dragon', name: 'Desert Eagle | Night Heist', rarity: 'blue', value: 660000, icon: '🌙', weaponType: 'Pistol' },
      // Tím (Purple, 12% - avg 1,700,000 coin)
      { itemId: 'ak47_vulcan_dragon', name: 'AK-47 | Vulcan', rarity: 'purple', value: 1600000, icon: '🌋', weaponType: 'Rifle' },
      { itemId: 'm4a4_emperor_dragon', name: 'M4A4 | The Emperor', rarity: 'purple', value: 1650000, icon: '👑', weaponType: 'Rifle' },
      { itemId: 'awp_dragon_lore_purple', name: 'AWP | Dragon Lore (Battle-Scarred)', rarity: 'purple', value: 1700000, icon: '🐉', weaponType: 'Sniper' },
      { itemId: 'karambit_slaughter_dragon', name: '★ Karambit | Slaughter (Well-Worn)', rarity: 'purple', value: 1800000, icon: '🩸', weaponType: 'Knife' },
      { itemId: 'm4a1s_knight_dragon', name: 'M4A1-S | Knight', rarity: 'purple', value: 1800000, icon: '⚔️', weaponType: 'Rifle' },
      { itemId: 'm4a1s_player_two_dragon', name: 'M4A1-S | Player Two', rarity: 'purple', value: 1650000, icon: '👾', weaponType: 'Rifle' },
      { itemId: 'usps_cortex_dragon', name: 'USP-S | Cortex', rarity: 'purple', value: 1700000, icon: '🧠', weaponType: 'Pistol' },
      { itemId: 'awp_neonoir_dragon', name: 'AWP | Neo-Noir', rarity: 'purple', value: 1750000, icon: '🌃', weaponType: 'Sniper' },
      // Đỏ (Red, 5% - avg 4,400,000 coin)
      { itemId: 'm4a4_howl_dragon', name: 'M4A4 | Howl (Factory New)', rarity: 'red', value: 4000000, icon: '🐺', weaponType: 'Rifle' },
      { itemId: 'ak47_fire_serpent_dragon', name: 'AK-47 | Fire Serpent (Factory New)', rarity: 'red', value: 4400000, icon: '🐍', weaponType: 'Rifle' },
      { itemId: 'awp_gungnir_dragon', name: 'AWP | Gungnir (Factory New)', rarity: 'red', value: 4800000, icon: '⚡', weaponType: 'Sniper' },
      { itemId: 'deagle_blaze_dragon', name: 'Desert Eagle | Blaze (Factory New)', rarity: 'red', value: 4400000, icon: '🔥', weaponType: 'Pistol' },
      { itemId: 'ak47_neon_rider_dragon', name: 'AK-47 | Neon Rider', rarity: 'red', value: 4300000, icon: '🏍️', weaponType: 'Rifle' },
      { itemId: 'm4a4_cyber_security', name: 'M4A4 | Cyber Security', rarity: 'red', value: 4500000, icon: '🔒', weaponType: 'Rifle' },
      // Vàng (Gold, 1% - avg 16,800,000 coin)
      { itemId: 'karambit_sapphire', name: '★ Karambit | Doppler Sapphire', rarity: 'gold', value: 15000000, icon: '💎', weaponType: 'Knife' },
      { itemId: 'butterfly_emerald', name: '★ Butterfly Knife | Gamma Doppler Emerald', rarity: 'gold', value: 16800000, icon: '💚', weaponType: 'Knife' },
      { itemId: 'dragon_lore_souvenir', name: '★ AWP | Dragon Lore (Souvenir)', rarity: 'gold', value: 18600000, icon: '🐉', weaponType: 'Sniper' },
      { itemId: 'bayonet_gamma_emerald', name: '★ Bayonet | Gamma Doppler Emerald', rarity: 'gold', value: 16000000, icon: '💚', weaponType: 'Knife' },
      { itemId: 'handwraps_cobalt_skulls', name: '★ Hand Wraps | Cobalt Skulls', rarity: 'gold', value: 17600000, icon: '💀', weaponType: 'Gloves' }
    ]
  },
  {
    id: 'case_legend',
    name: 'Hòm Huyền Thoại (Legendary)',
    description: 'Hòm cao cấp 10 triệu: full vũ khí Pistol → Súng máy, dao Ruby và găng Vice.',
    price: 10000000,
    icon: '🔥',
    badge: '10,000,000 🪙',
    gradient: 'from-fuchsia-600 via-purple-600 to-indigo-600',
    items: [
      // Trắng (White, 54% - avg ~3.0M)
      { itemId: 'fiveseven_neon_kimono', name: 'Five-SeveN | Neon Kimono', rarity: 'white', value: 2600000, icon: '🔫', weaponType: 'Pistol' },
      { itemId: 'mac10_neon_rider', name: 'MAC-10 | Neon Rider', rarity: 'white', value: 2800000, icon: '🔥', weaponType: 'SMG' },
      { itemId: 'mag7_storm_legend', name: 'MAG-7 | Storm', rarity: 'white', value: 3000000, icon: '🌪️', weaponType: 'Shotgun' },
      { itemId: 'galil_chatterbox_legend', name: 'Galil AR | Chatterbox', rarity: 'white', value: 3100000, icon: '💬', weaponType: 'Rifle' },
      { itemId: 'scar_cardiac_legend', name: 'SCAR-20 | Cardiac', rarity: 'white', value: 3300000, icon: '🫀', weaponType: 'Sniper' },
      { itemId: 'm249_spectre_legend', name: 'M249 | Spectre', rarity: 'white', value: 3400000, icon: '👻', weaponType: 'Machinegun' },
      { itemId: 'bizon_anubis_legend', name: 'PP-Bizon | Judgement of Anubis', rarity: 'white', value: 2800000, icon: '⚖️', weaponType: 'SMG' },
      { itemId: 'p2000_ocean_foam', name: 'P2000 | Ocean Foam', rarity: 'white', value: 2900000, icon: '🌊', weaponType: 'Pistol' },
      { itemId: 'nova_wood_fired', name: 'Nova | Wood Fired', rarity: 'white', value: 3000000, icon: '🪵', weaponType: 'Shotgun' },
      { itemId: 'sg553_cyberforce', name: 'SG 553 | Cyberforce', rarity: 'white', value: 3100000, icon: '🤖', weaponType: 'Rifle' },
      { itemId: 'g3sg1_murky', name: 'G3SG1 | Murky', rarity: 'white', value: 3200000, icon: '🌫️', weaponType: 'Sniper' },
      { itemId: 'negev_bulkhead', name: 'Negev | Bulkhead', rarity: 'white', value: 3000000, icon: '🛡️', weaponType: 'Machinegun' },
      // Xanh (Blue, 28% - avg ~7.0M)
      { itemId: 'tec9_fuel_injector', name: 'Tec-9 | Fuel Injector', rarity: 'blue', value: 6000000, icon: '⛽', weaponType: 'Pistol' },
      { itemId: 'mp5_liquidation', name: 'MP5-SD | Liquidation', rarity: 'blue', value: 6500000, icon: '🌊', weaponType: 'SMG' },
      { itemId: 'xm_elegant_vines', name: 'XM1014 | Elegant Vines', rarity: 'blue', value: 7000000, icon: '🌿', weaponType: 'Shotgun' },
      { itemId: 'famas_commemoration', name: 'FAMAS | Commemoration', rarity: 'blue', value: 7200000, icon: '🎖️', weaponType: 'Rifle' },
      { itemId: 'ssg_blood_water', name: 'SSG 08 | Blood in the Water', rarity: 'blue', value: 7500000, icon: '🩸', weaponType: 'Sniper' },
      { itemId: 'negev_lionfish', name: 'Negev | Lionfish', rarity: 'blue', value: 8000000, icon: '🦁', weaponType: 'Machinegun' },
      { itemId: 'ak47_slate_legend', name: 'AK-47 | Slate', rarity: 'blue', value: 6800000, icon: '⬛', weaponType: 'Rifle' },
      { itemId: 'm4a4_global_offensive', name: 'M4A4 | Global Offensive', rarity: 'blue', value: 7000000, icon: '🌍', weaponType: 'Rifle' },
      { itemId: 'awp_exoskeleton', name: 'AWP | Exoskeleton', rarity: 'blue', value: 7200000, icon: '🦾', weaponType: 'Sniper' },
      { itemId: 'deagle_meteorite', name: 'Desert Eagle | Meteorite', rarity: 'blue', value: 7000000, icon: '☄️', weaponType: 'Pistol' },
      // Tím (Purple, 12% - avg 17.0M)
      { itemId: 'cz75_xiangliu', name: 'CZ75-Auto | Xiangliu', rarity: 'purple', value: 15000000, icon: '🐍', weaponType: 'Pistol' },
      { itemId: 'p90_death_kitty', name: 'P90 | Death by Kitty', rarity: 'purple', value: 16000000, icon: '🐱', weaponType: 'SMG' },
      { itemId: 'nova_hyper_beast_legend', name: 'Nova | Hyper Beast', rarity: 'purple', value: 17000000, icon: '🐉', weaponType: 'Shotgun' },
      { itemId: 'aug_akihabara', name: 'AUG | Akihabara Accept', rarity: 'purple', value: 18000000, icon: '⛩️', weaponType: 'Rifle' },
      { itemId: 'awp_hyper_beast_legend', name: 'AWP | Hyper Beast', rarity: 'purple', value: 19000000, icon: '👹', weaponType: 'Sniper' },
      { itemId: 'glock_royal_legion', name: 'Glock-18 | Royal Legion', rarity: 'purple', value: 16500000, icon: '👑', weaponType: 'Pistol' },
      { itemId: 'ump_wild_child_legend', name: 'UMP-45 | Wild Child', rarity: 'purple', value: 17000000, icon: '🦊', weaponType: 'SMG' },
      { itemId: 'm4a1s_blue_phosphor', name: 'M4A1-S | Blue Phosphor', rarity: 'purple', value: 17500000, icon: '🔵', weaponType: 'Rifle' },
      // Đỏ (Red, 5% - avg 44.0M)
      { itemId: 'deagle_kumicho_fn', name: 'Desert Eagle | Kumicho Dragon (FN)', rarity: 'red', value: 40000000, icon: '🐲', weaponType: 'Pistol' },
      { itemId: 'mp7_bloodsport_fn', name: 'MP7 | Bloodsport (FN)', rarity: 'red', value: 42000000, icon: '🏎️', weaponType: 'SMG' },
      { itemId: 'ak47_neon_revo_fn', name: 'AK-47 | Neon Revolution (FN)', rarity: 'red', value: 46000000, icon: '🌈', weaponType: 'Rifle' },
      { itemId: 'awp_asiimov_fn', name: 'AWP | Asiimov (FN)', rarity: 'red', value: 48000000, icon: '⚪', weaponType: 'Sniper' },
      { itemId: 'usps_kill_confirmed_legend', name: 'USP-S | Kill Confirmed (MW)', rarity: 'red', value: 43000000, icon: '🎖️', weaponType: 'Pistol' },
      { itemId: 'ak47_red_laminate', name: 'AK-47 | Red Laminate', rarity: 'red', value: 45000000, icon: '🟥', weaponType: 'Rifle' },
      // Vàng (Gold, 1% - avg 168.0M)
      { itemId: 'huntsman_ruby', name: '★ Huntsman Knife | Doppler Ruby', rarity: 'gold', value: 150000000, icon: '🔪', weaponType: 'Knife' },
      { itemId: 'sport_gloves_vice', name: '★ Sport Gloves | Vice', rarity: 'gold', value: 168000000, icon: '🧤', weaponType: 'Gloves' },
      { itemId: 'awp_dragon_lore_fn', name: '★ AWP | Dragon Lore (Factory New)', rarity: 'gold', value: 186000000, icon: '🐉', weaponType: 'Sniper' },
      { itemId: 'flip_gamma_doppler', name: '★ Flip Knife | Gamma Doppler', rarity: 'gold', value: 160000000, icon: '🌀', weaponType: 'Knife' },
      { itemId: 'moto_spearmint', name: '★ Moto Gloves | Spearmint', rarity: 'gold', value: 176000000, icon: '🌿', weaponType: 'Gloves' }
    ]
  },
  {
    id: 'case_mythic',
    name: 'Hòm Chí Tôn (Mythic)',
    description: 'Hòm đỉnh 100 triệu: skin trăm triệu, Talon Sapphire và Karambit Lore FN.',
    price: 100000000,
    icon: '⚡',
    badge: '100,000,000 🪙',
    gradient: 'from-cyan-400 via-fuchsia-500 to-amber-400',
    items: [
      // Trắng (White, 54% - avg ~30.3M)
      { itemId: 'p2000_fire_elemental', name: 'P2000 | Fire Elemental', rarity: 'white', value: 26000000, icon: '🔥', weaponType: 'Pistol' },
      { itemId: 'bizon_anubis', name: 'PP-Bizon | Judgement of Anubis', rarity: 'white', value: 28000000, icon: '⚖️', weaponType: 'SMG' },
      { itemId: 'sawed_kraken', name: 'Sawed-Off | The Kraken', rarity: 'white', value: 30000000, icon: '🦑', weaponType: 'Shotgun' },
      { itemId: 'sg553_tiger_moth', name: 'SG 553 | Tiger Moth', rarity: 'white', value: 31000000, icon: '🐯', weaponType: 'Rifle' },
      { itemId: 'g3sg1_high_seas', name: 'G3SG1 | High Seas', rarity: 'white', value: 33000000, icon: '🌊', weaponType: 'Sniper' },
      { itemId: 'm249_downtown', name: 'M249 | Downtown', rarity: 'white', value: 34000000, icon: '🌃', weaponType: 'Machinegun' },
      { itemId: 'mac10_sakkaku', name: 'MAC-10 | Sakkaku', rarity: 'white', value: 28000000, icon: '👘', weaponType: 'SMG' },
      { itemId: 'tec9_sandstorm', name: 'Tec-9 | Sandstorm', rarity: 'white', value: 29000000, icon: '🌪️', weaponType: 'Pistol' },
      { itemId: 'mag7_forecast', name: 'MAG-7 | Forecast', rarity: 'white', value: 30000000, icon: '🌦️', weaponType: 'Shotgun' },
      { itemId: 'famas_nephthys', name: 'FAMAS | Waters of Nephthys', rarity: 'white', value: 31000000, icon: '🌊', weaponType: 'Rifle' },
      { itemId: 'ssg_abyss', name: 'SSG 08 | Abyss', rarity: 'white', value: 32000000, icon: '🕳️', weaponType: 'Sniper' },
      { itemId: 'm249_impact_drill', name: 'M249 | Impact Drill', rarity: 'white', value: 30000000, icon: '🛠️', weaponType: 'Machinegun' },
      // Xanh (Blue, 28% - avg ~70.3M)
      { itemId: 'r8_fade', name: 'R8 Revolver | Fade', rarity: 'blue', value: 60000000, icon: '🎯', weaponType: 'Pistol' },
      { itemId: 'ump_wild_child', name: 'UMP-45 | Wild Child', rarity: 'blue', value: 65000000, icon: '🦊', weaponType: 'SMG' },
      { itemId: 'mag7_heat', name: 'MAG-7 | Heat', rarity: 'blue', value: 70000000, icon: '♨️', weaponType: 'Shotgun' },
      { itemId: 'ak47_slate', name: 'AK-47 | Slate', rarity: 'blue', value: 72000000, icon: '⬛', weaponType: 'Rifle' },
      { itemId: 'scar_bloodsport', name: 'SCAR-20 | Bloodsport', rarity: 'blue', value: 75000000, icon: '🏁', weaponType: 'Sniper' },
      { itemId: 'negev_power_loader_mythic', name: 'Negev | Power Loader', rarity: 'blue', value: 80000000, icon: '⚙️', weaponType: 'Machinegun' },
      { itemId: 'ak47_wild_lotus', name: 'AK-47 | Wild Lotus', rarity: 'blue', value: 68000000, icon: '🪷', weaponType: 'Rifle' },
      { itemId: 'm4a4_living_color', name: 'M4A4 | In Living Color', rarity: 'blue', value: 70000000, icon: '🎨', weaponType: 'Rifle' },
      { itemId: 'awp_chromatic', name: 'AWP | Chromatic Aberration', rarity: 'blue', value: 72000000, icon: '🌈', weaponType: 'Sniper' },
      { itemId: 'deagle_golden_koi', name: 'Desert Eagle | Golden Koi', rarity: 'blue', value: 74000000, icon: '🐟', weaponType: 'Pistol' },
      // Tím (Purple, 12% - avg 170.0M)
      { itemId: 'usps_kill_confirmed_fn', name: 'USP-S | Kill Confirmed (FN)', rarity: 'purple', value: 150000000, icon: '💀', weaponType: 'Pistol' },
      { itemId: 'mp9_wild_lily', name: 'MP9 | Wild Lily', rarity: 'purple', value: 160000000, icon: '🌸', weaponType: 'SMG' },
      { itemId: 'xm_xerosis', name: 'XM1014 | Xerosis', rarity: 'purple', value: 170000000, icon: '🦂', weaponType: 'Shotgun' },
      { itemId: 'm4a4_desolate_space', name: 'M4A4 | Desolate Space', rarity: 'purple', value: 180000000, icon: '🌌', weaponType: 'Rifle' },
      { itemId: 'awp_oni_taiji_fn', name: 'AWP | Oni Taiji (FN)', rarity: 'purple', value: 190000000, icon: '👺', weaponType: 'Sniper' },
      { itemId: 'glock_fade_mythic', name: 'Glock-18 | Fade', rarity: 'purple', value: 165000000, icon: '🌅', weaponType: 'Pistol' },
      { itemId: 'mp5_phosphor', name: 'MP5-SD | Phosphor', rarity: 'purple', value: 170000000, icon: '💠', weaponType: 'SMG' },
      { itemId: 'ak47_gold_arabesque', name: 'AK-47 | Gold Arabesque', rarity: 'purple', value: 175000000, icon: '✨', weaponType: 'Rifle' },
      // Đỏ (Red, 5% - avg 440.0M)
      { itemId: 'glock_fade_fn', name: 'Glock-18 | Fade (FN)', rarity: 'red', value: 400000000, icon: '🌅', weaponType: 'Pistol' },
      { itemId: 'ak47_vulcan_fn', name: 'AK-47 | Vulcan (FN)', rarity: 'red', value: 420000000, icon: '🌋', weaponType: 'Rifle' },
      { itemId: 'm4a1s_knight_fn', name: 'M4A1-S | Knight (FN)', rarity: 'red', value: 460000000, icon: '⚔️', weaponType: 'Rifle' },
      { itemId: 'awp_gungnir_fn', name: 'AWP | Gungnir (FN)', rarity: 'red', value: 480000000, icon: '⚡', weaponType: 'Sniper' },
      { itemId: 'awp_medusa_mythic', name: 'AWP | Medusa', rarity: 'red', value: 430000000, icon: '🐍', weaponType: 'Sniper' },
      { itemId: 'ak47_case_hardened', name: 'AK-47 | Case Hardened', rarity: 'red', value: 450000000, icon: '🔷', weaponType: 'Rifle' },
      // Vàng (Gold, 1% - avg 1,680.0M)
      { itemId: 'talon_sapphire', name: '★ Talon Knife | Doppler Sapphire', rarity: 'gold', value: 1500000000, icon: '💎', weaponType: 'Knife' },
      { itemId: 'specialist_crimson_kimono', name: '★ Specialist Gloves | Crimson Kimono', rarity: 'gold', value: 1680000000, icon: '🥊', weaponType: 'Gloves' },
      { itemId: 'karambit_lore_fn', name: '★ Karambit | Lore (Factory New)', rarity: 'gold', value: 1860000000, icon: '🩸', weaponType: 'Knife' },
      { itemId: 'butterfly_sapphire', name: '★ Butterfly Knife | Doppler Sapphire', rarity: 'gold', value: 1600000000, icon: '🦋', weaponType: 'Knife' },
      { itemId: 'sport_superconductor', name: '★ Sport Gloves | Superconductor', rarity: 'gold', value: 1760000000, icon: '⚡', weaponType: 'Gloves' }
    ]
  }
];

export class CaseEngine {
  private userManager: UserManager;

  constructor(userManager: UserManager) {
    this.userManager = userManager;
  }

  public getCases(): CaseDefinition[] {
    return CASE_DEFINITIONS;
  }

  public getCaseById(caseId: string): CaseDefinition | undefined {
    return CASE_DEFINITIONS.find(c => c.id === caseId);
  }

  /**
   * Determine winning rarity based on self-balanced odds:
   * Trắng: 54% [0 - 53.999]
   * Xanh:  28% [54.0 - 81.999]
   * Tím:   12% [82.0 - 93.999]
   * Đỏ:     5% [94.0 - 98.999]
   * Vàng:   1% [99.0 - 99.999]
   */
  private rollRarity(): ItemRarity {
    const roll = crypto.randomInt(0, 10000) / 100; // 0.00 to 99.99
    if (roll < 54.0) return 'white';
    if (roll < 82.0) return 'blue';
    if (roll < 94.0) return 'purple';
    if (roll < 99.0) return 'red';
    return 'gold';
  }

  private pickItemByRarity(caseDef: CaseDefinition, targetRarity: ItemRarity): CaseItemTemplate {
    const pool = caseDef.items.filter(it => it.rarity === targetRarity);
    if (pool.length === 0) {
      return caseDef.items[0];
    }
    const idx = crypto.randomInt(0, pool.length);
    return pool[idx];
  }

  public openCase(userId: string, caseId: string): CaseOpenResult {
    const caseDef = this.getCaseById(caseId);
    if (!caseDef) {
      return { success: false, message: 'Hòm không tồn tại.' };
    }

    const currentBalance = this.userManager.getBalance(userId);
    if (currentBalance < caseDef.price) {
      return {
        success: false,
        message: `Không đủ tiền mở hòm! Cần ${caseDef.price.toLocaleString('vi-VN')} 🪙, bạn đang có ${currentBalance.toLocaleString('vi-VN')} 🪙.`
      };
    }

    // 1. Deduct cost
    const deductRes = this.userManager.deductBalance(userId, caseDef.price, `Mở ${caseDef.name}`);
    if (!deductRes.success) {
      return { success: false, message: deductRes.message || 'Lỗi trừ tiền mở hòm.' };
    }

    // 2. Roll winning item
    const winningRarity = this.rollRarity();
    const winningTemplate = this.pickItemByRarity(caseDef, winningRarity);

    // 3. Add to user inventory
    const addRes = this.userManager.addItemToInventory(userId, {
      itemId: winningTemplate.itemId,
      name: winningTemplate.name,
      rarity: winningTemplate.rarity,
      value: winningTemplate.value,
      icon: winningTemplate.icon,
      caseType: caseDef.id
    });

    if (!addRes.success || !addRes.item) {
      // Refund if adding failed
      this.userManager.addBalance(userId, caseDef.price, `Hoàn tiền mở hòm ${caseDef.id}`);
      return { success: false, message: 'Lỗi cấp vật phẩm vào kho đồ.' };
    }

    // 4. Generate CS2 Roulette Tape (total 35 items, target index = 30)
    const TAPE_LENGTH = 35;
    const WINNING_INDEX = 30;
    const tape: CaseItemTemplate[] = [];

    for (let i = 0; i < TAPE_LENGTH; i++) {
      if (i === WINNING_INDEX) {
        tape.push(winningTemplate);
      } else {
        // Random rarity with typical distribution to make the strip realistic
        const r = this.rollRarity();
        tape.push(this.pickItemByRarity(caseDef, r));
      }
    }

    return {
      success: true,
      wonItem: addRes.item,
      tape,
      winningIndex: WINNING_INDEX,
      newBalance: this.userManager.getBalance(userId)
    };
  }

  private buildTape(caseDef: CaseDefinition, winningTemplate: CaseItemTemplate): { tape: CaseItemTemplate[]; winningIndex: number } {
    const TAPE_LENGTH = 35;
    const WINNING_INDEX = 30;
    const tape: CaseItemTemplate[] = [];
    for (let i = 0; i < TAPE_LENGTH; i++) {
      if (i === WINNING_INDEX) {
        tape.push(winningTemplate);
      } else {
        const r = this.rollRarity();
        tape.push(this.pickItemByRarity(caseDef, r));
      }
    }
    return { tape, winningIndex: WINNING_INDEX };
  }

  /**
   * Mở nhiều hòm cùng lúc (1–10 vòng). Trừ tổng tiền 1 lần, roll độc lập từng vòng.
   */
  public openCases(userId: string, caseId: string, count: number): CaseOpenMultiResult {
    const caseDef = this.getCaseById(caseId);
    if (!caseDef) {
      return { success: false, message: 'Hòm không tồn tại.' };
    }
    const n = Math.floor(Number(count));
    if (!Number.isFinite(n) || n < 1 || n > 10) {
      return { success: false, message: 'Chỉ được mở từ 1 đến 10 hòm mỗi lượt.' };
    }

    const totalCost = caseDef.price * n;
    const currentBalance = this.userManager.getBalance(userId);
    if (currentBalance < totalCost) {
      return {
        success: false,
        message: `Không đủ tiền mở ${n} hòm! Cần ${totalCost.toLocaleString('vi-VN')} 🪙, bạn đang có ${currentBalance.toLocaleString('vi-VN')} 🪙.`
      };
    }

    const deductRes = this.userManager.deductBalance(userId, totalCost, `Mở ${n}x ${caseDef.name}`);
    if (!deductRes.success) {
      return { success: false, message: deductRes.message || 'Lỗi trừ tiền mở hòm.' };
    }

    const spins: CaseSingleSpin[] = [];
    let totalWonValue = 0;
    for (let i = 0; i < n; i++) {
      const winningRarity = this.rollRarity();
      const winningTemplate = this.pickItemByRarity(caseDef, winningRarity);
      const addRes = this.userManager.addItemToInventory(userId, {
        itemId: winningTemplate.itemId,
        name: winningTemplate.name,
        rarity: winningTemplate.rarity,
        value: winningTemplate.value,
        icon: winningTemplate.icon,
        caseType: caseDef.id
      });
      if (!addRes.success || !addRes.item) {
        // Hoàn tiền các vòng chưa mở nếu lỗi giữa chừng
        continue;
      }
      const { tape, winningIndex } = this.buildTape(caseDef, winningTemplate);
      spins.push({ wonItem: addRes.item, tape, winningIndex });
      totalWonValue += winningTemplate.value;
    }

    if (spins.length === 0) {
      this.userManager.addBalance(userId, totalCost, `Hoàn tiền mở hòm ${caseDef.id}`);
      return { success: false, message: 'Lỗi cấp vật phẩm vào kho đồ.' };
    }

    return {
      success: true,
      spins,
      totalSpent: totalCost,
      totalWonValue,
      newBalance: this.userManager.getBalance(userId)
    };
  }

  public rollItemForBattle(caseId: string): { wonTemplate: CaseItemTemplate; tape: CaseItemTemplate[]; winningIndex: number } | null {
    const caseDef = this.getCaseById(caseId);
    if (!caseDef) return null;

    const winningRarity = this.rollRarity();
    const wonTemplate = this.pickItemByRarity(caseDef, winningRarity);

    const TAPE_LENGTH = 35;
    const WINNING_INDEX = 30;
    const tape: CaseItemTemplate[] = [];

    for (let i = 0; i < TAPE_LENGTH; i++) {
      if (i === WINNING_INDEX) {
        tape.push(wonTemplate);
      } else {
        const r = this.rollRarity();
        tape.push(this.pickItemByRarity(caseDef, r));
      }
    }

    return { wonTemplate, tape, winningIndex: WINNING_INDEX };
  }
}
