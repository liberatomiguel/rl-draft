/**
 * Road to Worlds — fictional name banks (career-only data).
 *
 * Used by deterministic generators (filler teams, procedural rookies,
 * emergency stand-ins). Every name here is INVENTED — no real player or org
 * names — flagged fictional so they never touch achievements/collection.
 *
 * NEVER imported by src/data/index.ts (the main barrel stays career-free);
 * loaded lazily with the rest of the career layer.
 */

import type { Region } from "@/engine/types";

/** Fictional player nicknames per region (~40 each, EN-safe gamer tags). */
export const PLAYER_NAME_BANK: Record<Region, string[]> = {
  NA: [
    "Voltz", "Skyline", "Recoil", "Drifty", "Maverick8", "Pylon", "Hexon", "Slipstream",
    "Krow", "Nitro5", "Fadeaway", "Bricked", "Ozone", "Twitchy", "Halfline", "Draftking",
    "Cutback", "Jetline", "Snipes", "Redline", "Vandal", "Moonshot", "Klutch9", "Stallout",
    "Overtime", "Pinchpoint", "Ballside", "Freeplay", "Whiffer", "Boostlord", "Ceiling",
    "Musty4", "Airdrib", "Demoman", "Cornerman", "Fifty", "Rotate", "Netminder", "Kicker", "Zoomer",
  ],
  EU: [
    "Vexo", "Nordik", "Rhyzer", "Aetro", "Cobalt", "Fluxx", "Kaptn", "Wyvern",
    "Tempo", "Skylar7", "Mirage", "Nova9", "Bastion", "Kessler", "Riko", "Anders",
    "Duskfall", "Elyzian", "Fjord", "Gravel", "Helix", "Ivory", "Jester", "Krait",
    "Lumen", "Meister", "Noxious", "Orbital", "Prism", "Quantum", "Rasper", "Stille",
    "Tackla", "Umbra", "Vanta", "Wexley", "Yonder", "Zephyr", "Arclight", "Brindle",
  ],
  SAM: [
    "Furacao", "Zico7", "Pantera", "Relampago", "Curinga", "Vendaval", "Tornado",
    "Mandrake", "Feiticeiro", "Canhao", "Foguete", "Trovao", "Selvagem", "Bruxo",
    "Craque", "Pivete", "Malandro", "Girassol", "Cacique", "Tucano", "Jaguar",
    "Vulcao", "Meteoro", "Cometa", "Falcao", "Corvo", "Lobo", "Serpente", "Tigre",
    "Aguia", "Piranha", "Raposa", "Golazo", "Pibe", "Gaucho", "Charrua", "Andino",
    "Inca", "Chaski", "Condor",
  ],
  MENA: [
    "Sahara", "Mirage7", "Falcon1", "Dune", "Oasis", "Scimitar", "Sultan", "Nomad",
    "Zenith", "Karam", "Rashid9", "Amir", "Basil", "Dahab", "Emir", "Faris",
    "Ghazal", "Haris", "Idris", "Jamal7", "Khalid", "Layth", "Malik", "Nasser",
    "Omar5", "Qamar", "Rami", "Samir", "Tariq", "Wael", "Yasin", "Zayd",
    "Anwar", "Bashir", "Cyrus", "Darwish", "Elyas", "Fahad", "Ghaith", "Hamza",
  ],
  OCE: [
    "Wallaby", "Reefer", "Outback", "Boomer", "Cyclone", "Dingo", "Eucal", "Fremantle",
    "Gully", "Harbour", "Ironbark", "Jarrah", "Koala", "Larrikin", "Matey", "Noosa",
    "Opal", "Perthy", "Quokka", "Ripcurl", "Sheila", "Taipan", "Uluru", "Vegemite",
    "Wombat", "Yabby", "Zedline", "Bandit", "Cobber", "Digger", "Esky", "Footy",
    "Galah", "Hoon", "Icebreak", "Jackaroo", "Kelpie", "Lorikeet", "Mullet", "Ned",
  ],
  APAC: [
    "Ronin", "Kitsune", "Tempest", "Shogun", "Kaze", "Ryujin", "Hana", "Ikari",
    "Jin", "Kaito", "Luna9", "Mochi", "Ninja7", "Oni", "Pixel", "Quill",
    "Raiden", "Sora", "Tora", "Ume", "Viper", "Wasabi", "Xin", "Yuki",
    "Zenko", "Akira", "Bento", "Chai", "Daichi", "Ember", "Fuji", "Genki",
    "Haru", "Indra", "Jaya", "Kancil", "Lotus", "Merlion", "Naga", "Orchid",
  ],
  SSA: [
    "Baobab", "Cheetah", "Dunes", "Eland", "Fynbos", "Giraffe", "Highveld", "Impala",
    "Jozi", "Kalahari", "Lion7", "Mamba", "Nyala", "Okavango", "Protea", "Quagga",
    "Rooibos", "Springbok", "Tsessebe", "Ubuntu", "Veld", "Windhoek", "Xhosa", "Yebo",
    "Zambezi", "Acacia", "Biltong", "Cape9", "Drakens", "Etosha", "Flamingo", "Gemsbok",
    "Hippo", "Injongo", "Jacaranda", "Karoo", "Lekker", "Marula", "Naartjie", "Oryx",
  ],
};

/** Fictional filler-org names per region (~14 each — enough for 16-team fields). */
export const FILLER_ORG_NAME_BANK: Record<Region, string[]> = {
  NA: [
    "Apex Verge", "Midnight Circuit", "Iron Summit", "Neon District", "Fault Line",
    "Copperhead GG", "Vantage Point", "Static Nine", "Blue Ridge Esports", "Overclock City",
    "Junction Four", "Farside Gaming", "Redshift Union", "Parallel Park",
  ],
  EU: [
    "Nordwind Esports", "Cathedral Gaming", "Velvet Owls", "Meridian Five", "Alpenstorm",
    "Old Continent", "Saphir Club", "Ironclad EU", "Borealis Order", "Cobblestone",
    "Skagerrak", "Ravenspire", "Lumiere Esports", "Bastide Club",
  ],
  SAM: [
    "Carnaval Kings", "Selva Esports", "Mate Amargo", "Porto Rocket", "Andes Union",
    "Favela Flyers", "Pampa Attack", "Rio Verde GG", "Sertao Squad", "Cordillera Club",
    "Amazonia Prime", "Litoral Esports", "Cerrado Wolves", "La Banda GG",
  ],
  MENA: [
    "Desert Crown", "Medina Rising", "Falcon Dynasty", "Oasis Prime", "Petra Legion",
    "Levant Five", "Gulf Breakers", "Casbah Club", "Sirocco GG", "Aladdin's Boost",
    "Bedouin Circuit", "Nile Vanguard", "Zephyr Arabia", "Sahara Nine",
  ],
  OCE: [
    "Coral Sea Club", "Southern Cross GG", "Tasman Fury", "Redback Esports", "Kiwi Circuit",
    "Bondi Breakers", "Outrigger", "Cape Reinga", "Bushfire Five", "Dropbear Squad",
    "Anzac Rocket", "Coastline GG", "Wattle Corps", "Harbourside",
  ],
  APAC: [
    "Jade Dynasty", "Monsoon Five", "Sakura Drift", "Tiger Strait", "Archipelago GG",
    "Neon Harbor", "Garuda Prime", "Typhoon Corps", "Lantern Club", "Mekong Rising",
    "Pearl Circuit", "Shinobi Esports", "Halcyon East", "Borneo Boost",
  ],
  SSA: [
    "Savanna Kings", "Table Mountain", "Kalahari Circuit", "Ubuntu United", "Sahel Squad",
    "Golden Reef", "Serengeti Five", "Atlas Lions GG", "Cape Storm", "Victoria Falls",
    "Okapi Esports", "Zulu Kingdom", "Harmattan", "Kilimanjaro Club",
  ],
};

/** Fictional unofficial-tournament name pools (rotated deterministically). */
export const T3_EVENT_NAMES = [
  "The Grid Open", "Boost Bracket", "Kickoff Clash", "Garage Series", "Rocket Rumble",
  "Sunday Circuit", "Neon Cup", "Backboard Bash", "Aerial Alley", "Demo Derby",
];
export const T2_EVENT_NAMES = [
  "Champions Invitational", "Prime Showdown", "Elite Eight", "Signature Series",
  "Crown Circuit", "Velocity Invitational", "Apex Gathering", "Masters Table",
];

/** Emergency stand-in identities (one per region, fictional 60-OVR rentals). */
export const STAND_IN_NAMES: Record<Region, string> = {
  NA: "FillerUp", EU: "LastCall", SAM: "QuebraGalho", MENA: "Sandstorm",
  OCE: "PinchHit", APAC: "Kaeru", SSA: "Sharpline",
};

/**
 * v2.0 (R23) local amateur scene — the community teams a new org meets at
 * Community Cups. rc.2: PER REGION, with the regional flavour the filler orgs
 * already have (Miguel: the SAM names should read like SAM — Mate Amargo,
 * Pão de Queijo — not like generic Rocket League slang). Amateur-sounding on
 * purpose, so they never read like the pro orgs.
 */
export const LOCAL_TEAM_NAME_BANK: Record<Region, readonly string[]> = {
  NA: [
    "Garage Kings", "Late Night Rotations", "Pocket Rockets", "Backboard Boys", "Flip Reset FC",
    "Dorm Room Demos", "Route 66 Boost", "Tailgate Tappers", "Basement Ballers", "Diner Dashers",
    "Lake Effect", "Pit Stop Crew", "Half Flip Hooligans", "Whiff City", "Rotation Nation",
    "Open Net Heroes",
  ],
  EU: [
    "Kebab Kickoffs", "Tram Line Five", "Pub Quiz Rotations", "Autobahn Boost", "Fjordside FC",
    "Low Countries", "Cobblestone Crew", "Tapas Touch", "Midnight Sun", "Schnitzel Shadow",
    "Baguette Bumpers", "Canal Side", "Alpine Air Roll", "Pierogi Pinch", "Ballcam Off", "Last Touch",
  ],
  SAM: [
    "Pão de Queijo FC", "Mate Amargo Juniors", "Bonde do Boost", "Galera do Açaí", "Tchê Rocket",
    "Favela Flyers B", "Quebra-Galho", "Pelada de Sábado", "Alfajor Attack", "Churrasco Crew",
    "Pastel de Feira", "Sertão Squad B", "Guaraná Jet", "Pampa Pivetes", "Tapioca Touch", "Caipira Kickoff",
  ],
  MENA: [
    "Souk Rockets", "Shawarma Squad", "Corniche Crew", "Falafel Flyers", "Desert Rose FC",
    "Oasis Juniors", "Casbah Kickoffs", "Dune Drifters", "Medina Boost", "Nile Side",
    "Karak Collective", "Majlis Rotations", "Sirocco B", "Dhow Dashers", "Mint Tea Touch", "Wadi Wave",
  ],
  OCE: [
    "Servo Snags", "Arvo Rotations", "Bush Telly", "Esky Dashers", "Dropbear Juniors",
    "Long Weekend FC", "Thongs On", "Sunday Sesh", "Meat Pie Crew", "Jandal Jets",
    "Pavlova Pinch", "Outback Open Net", "Tradie Touch", "Surf Club B", "Goon Bag Boost", "Flat White FC",
  ],
  APAC: [
    "Hawker Centre FC", "Night Market Crew", "Ramen Rotations", "Boba Boost", "Karaoke Kickoffs",
    "Tuk-Tuk Touch", "Jeepney Jets", "Mahjong Mechanics", "Kopi Collective", "Durian Demos",
    "Monsoon Juniors", "Bubble Tea B", "Satay Squad", "Shophouse Shadow", "Tatami Touch", "Padang Pinch",
  ],
  SSA: [
    "Braai Brothers", "Minibus Rotations", "Jollof Jets", "Township Touch", "Boerewors Boost",
    "Chapati Crew", "Matatu Mechanics", "Biltong Ballers", "Shisa Nyama FC", "Nollywood Nets",
    "Kota Kickoffs", "Savanna Juniors", "Pap & Boost", "Rooibos B", "Dala Dashers", "Veld Vibes",
  ],
};
