export type Alignment = 'west' | 'east' | 'wildcard' | 'independent'

export interface CityProfile {
  id: string
  countryId: string
  name: string
  lat: number
  lng: number
  population: number
  populationDensity: number
  isCapital?: boolean
}

export interface WeaponProfile {
  name: string
  deliveryType: 'ICBM' | 'SLBM' | 'Ballistic missile'
  yield_kt: number
}

export interface CountryProfile {
  alignment: Alignment
  cities: CityProfile[]
  weapons: WeaponProfile[]
}

export const EDUCATIONAL_ALIGNMENT_LABELS: Record<Alignment, string> = {
  west: 'West bloc (simplified educational model)',
  east: 'East bloc (simplified educational model)',
  wildcard: 'Wildcard regional actor (simplified educational model)',
  independent: 'Independent actor (simplified educational model)',
}

export const COUNTRY_PROFILES: Record<string, CountryProfile> = {
  US: {
    alignment: 'west',
    weapons: [
      { name: 'Minuteman III', deliveryType: 'ICBM', yield_kt: 300 },
      { name: 'Trident II D5', deliveryType: 'SLBM', yield_kt: 455 },
      { name: 'Minuteman III', deliveryType: 'ICBM', yield_kt: 300 },
      { name: 'Trident II D5', deliveryType: 'SLBM', yield_kt: 100 },
    ],
    cities: [
      { id: 'us-washington', countryId: 'US', name: 'Washington, D.C.', lat: 38.9072, lng: -77.0369, population: 689545, populationDensity: 4300, isCapital: true },
      { id: 'us-new-york', countryId: 'US', name: 'New York City', lat: 40.7128, lng: -74.006, population: 8804190, populationDensity: 10900 },
      { id: 'us-los-angeles', countryId: 'US', name: 'Los Angeles', lat: 34.0522, lng: -118.2437, population: 3898747, populationDensity: 3200 },
      { id: 'us-chicago', countryId: 'US', name: 'Chicago', lat: 41.8781, lng: -87.6298, population: 2746388, populationDensity: 4600 },
      { id: 'us-houston', countryId: 'US', name: 'Houston', lat: 29.7604, lng: -95.3698, population: 2304580, populationDensity: 1400 },
      { id: 'us-san-francisco', countryId: 'US', name: 'San Francisco', lat: 37.7749, lng: -122.4194, population: 808988, populationDensity: 7300 },
      { id: 'us-seattle', countryId: 'US', name: 'Seattle', lat: 47.6062, lng: -122.3321, population: 749256, populationDensity: 3400 },
    ],
  },
  Russia: {
    alignment: 'east',
    weapons: [
      { name: 'RS-28 Sarmat', deliveryType: 'ICBM', yield_kt: 800 },
      { name: 'Bulava', deliveryType: 'SLBM', yield_kt: 150 },
      { name: 'RS-24 Yars', deliveryType: 'ICBM', yield_kt: 500 },
      { name: 'Bulava', deliveryType: 'SLBM', yield_kt: 100 },
    ],
    cities: [
      { id: 'ru-moscow', countryId: 'Russia', name: 'Moscow', lat: 55.7558, lng: 37.6173, population: 13010495, populationDensity: 5100, isCapital: true },
      { id: 'ru-stpetersburg', countryId: 'Russia', name: 'St. Petersburg', lat: 59.9311, lng: 30.3609, population: 5601911, populationDensity: 3900 },
      { id: 'ru-novosibirsk', countryId: 'Russia', name: 'Novosibirsk', lat: 55.0084, lng: 82.9357, population: 1633595, populationDensity: 3300 },
      { id: 'ru-yekaterinburg', countryId: 'Russia', name: 'Yekaterinburg', lat: 56.8389, lng: 60.6057, population: 1539371, populationDensity: 3100 },
      { id: 'ru-kazan', countryId: 'Russia', name: 'Kazan', lat: 55.7961, lng: 49.1064, population: 1318604, populationDensity: 2400 },
      { id: 'ru-vladivostok', countryId: 'Russia', name: 'Vladivostok', lat: 43.1155, lng: 131.8855, population: 603519, populationDensity: 2900 },
    ],
  },
  China: {
    alignment: 'east',
    weapons: [
      { name: 'DF-41', deliveryType: 'ICBM', yield_kt: 1000 },
      { name: 'JL-3', deliveryType: 'SLBM', yield_kt: 250 },
      { name: 'DF-31A', deliveryType: 'ICBM', yield_kt: 330 },
    ],
    cities: [
      { id: 'cn-beijing', countryId: 'China', name: 'Beijing', lat: 39.9042, lng: 116.4074, population: 21893095, populationDensity: 1300, isCapital: true },
      { id: 'cn-shanghai', countryId: 'China', name: 'Shanghai', lat: 31.2304, lng: 121.4737, population: 24870895, populationDensity: 3900 },
      { id: 'cn-guangzhou', countryId: 'China', name: 'Guangzhou', lat: 23.1291, lng: 113.2644, population: 18676605, populationDensity: 1900 },
      { id: 'cn-shenzhen', countryId: 'China', name: 'Shenzhen', lat: 22.5431, lng: 114.0579, population: 17661900, populationDensity: 6800 },
      { id: 'cn-chongqing', countryId: 'China', name: 'Chongqing', lat: 29.4316, lng: 106.9123, population: 16382376, populationDensity: 390 },
      { id: 'cn-tianjin', countryId: 'China', name: 'Tianjin', lat: 39.3434, lng: 117.3616, population: 13866009, populationDensity: 1300 },
    ],
  },
  UK: {
    alignment: 'west',
    weapons: [
      { name: 'Trident II D5', deliveryType: 'SLBM', yield_kt: 100 },
    ],
    cities: [
      { id: 'uk-london', countryId: 'UK', name: 'London', lat: 51.5072, lng: -0.1276, population: 8982000, populationDensity: 5700, isCapital: true },
      { id: 'uk-birmingham', countryId: 'UK', name: 'Birmingham', lat: 52.4862, lng: -1.8904, population: 1141816, populationDensity: 4100 },
      { id: 'uk-manchester', countryId: 'UK', name: 'Manchester', lat: 53.4808, lng: -2.2426, population: 568996, populationDensity: 4800 },
      { id: 'uk-glasgow', countryId: 'UK', name: 'Glasgow', lat: 55.8642, lng: -4.2518, population: 635640, populationDensity: 3600 },
    ],
  },
  France: {
    alignment: 'west',
    weapons: [
      { name: 'M51', deliveryType: 'SLBM', yield_kt: 300 },
      { name: 'ASMP-A', deliveryType: 'Ballistic missile', yield_kt: 100 },
    ],
    cities: [
      { id: 'fr-paris', countryId: 'France', name: 'Paris', lat: 48.8566, lng: 2.3522, population: 2102650, populationDensity: 20500, isCapital: true },
      { id: 'fr-marseille', countryId: 'France', name: 'Marseille', lat: 43.2965, lng: 5.3698, population: 877215, populationDensity: 3600 },
      { id: 'fr-lyon', countryId: 'France', name: 'Lyon', lat: 45.764, lng: 4.8357, population: 522969, populationDensity: 10600 },
      { id: 'fr-toulouse', countryId: 'France', name: 'Toulouse', lat: 43.6047, lng: 1.4442, population: 504078, populationDensity: 4000 },
    ],
  },
  Germany: {
    alignment: 'west',
    weapons: [],
    cities: [
      { id: 'de-berlin', countryId: 'Germany', name: 'Berlin', lat: 52.52, lng: 13.405, population: 3644826, populationDensity: 4100, isCapital: true },
      { id: 'de-hamburg', countryId: 'Germany', name: 'Hamburg', lat: 53.5511, lng: 9.9937, population: 1841179, populationDensity: 2500 },
      { id: 'de-munich', countryId: 'Germany', name: 'Munich', lat: 48.1351, lng: 11.582, population: 1488202, populationDensity: 4900 },
      { id: 'de-cologne', countryId: 'Germany', name: 'Cologne', lat: 50.9375, lng: 6.9603, population: 1085664, populationDensity: 2700 },
    ],
  },
  Italy: {
    alignment: 'west',
    weapons: [],
    cities: [
      { id: 'it-rome', countryId: 'Italy', name: 'Rome', lat: 41.9028, lng: 12.4964, population: 2872800, populationDensity: 2200, isCapital: true },
      { id: 'it-milan', countryId: 'Italy', name: 'Milan', lat: 45.4642, lng: 9.19, population: 1366180, populationDensity: 7600 },
      { id: 'it-naples', countryId: 'Italy', name: 'Naples', lat: 40.8518, lng: 14.2681, population: 909048, populationDensity: 7900 },
      { id: 'it-turin', countryId: 'Italy', name: 'Turin', lat: 45.0703, lng: 7.6869, population: 848885, populationDensity: 6600 },
    ],
  },
  Poland: {
    alignment: 'west',
    weapons: [],
    cities: [
      { id: 'pl-warsaw', countryId: 'Poland', name: 'Warsaw', lat: 52.2297, lng: 21.0122, population: 1863056, populationDensity: 3600, isCapital: true },
      { id: 'pl-krakow', countryId: 'Poland', name: 'Krakow', lat: 50.0647, lng: 19.945, population: 804237, populationDensity: 2400 },
      { id: 'pl-lodz', countryId: 'Poland', name: 'Lodz', lat: 51.7592, lng: 19.456, population: 664860, populationDensity: 2200 },
      { id: 'pl-wroclaw', countryId: 'Poland', name: 'Wroclaw', lat: 51.1079, lng: 17.0385, population: 674132, populationDensity: 2300 },
    ],
  },
  Turkey: {
    alignment: 'west',
    weapons: [],
    cities: [
      { id: 'tr-ankara', countryId: 'Turkey', name: 'Ankara', lat: 39.9334, lng: 32.8597, population: 5663322, populationDensity: 2200, isCapital: true },
      { id: 'tr-istanbul', countryId: 'Turkey', name: 'Istanbul', lat: 41.0082, lng: 28.9784, population: 15636243, populationDensity: 3000 },
      { id: 'tr-izmir', countryId: 'Turkey', name: 'Izmir', lat: 38.4237, lng: 27.1428, population: 4367251, populationDensity: 360 },
      { id: 'tr-bursa', countryId: 'Turkey', name: 'Bursa', lat: 40.1885, lng: 29.061, population: 3101833, populationDensity: 530 },
    ],
  },
  Japan: {
    alignment: 'west',
    weapons: [],
    cities: [
      { id: 'jp-tokyo', countryId: 'Japan', name: 'Tokyo', lat: 35.6762, lng: 139.6503, population: 13960000, populationDensity: 6400, isCapital: true },
      { id: 'jp-yokohama', countryId: 'Japan', name: 'Yokohama', lat: 35.4437, lng: 139.638, population: 3777491, populationDensity: 8600 },
      { id: 'jp-osaka', countryId: 'Japan', name: 'Osaka', lat: 34.6937, lng: 135.5023, population: 2752412, populationDensity: 12100 },
      { id: 'jp-nagoya', countryId: 'Japan', name: 'Nagoya', lat: 35.1815, lng: 136.9066, population: 2332176, populationDensity: 7200 },
    ],
  },
  SouthKorea: {
    alignment: 'west',
    weapons: [],
    cities: [
      { id: 'kr-seoul', countryId: 'SouthKorea', name: 'Seoul', lat: 37.5665, lng: 126.978, population: 9508451, populationDensity: 15600, isCapital: true },
      { id: 'kr-busan', countryId: 'SouthKorea', name: 'Busan', lat: 35.1796, lng: 129.0756, population: 3348737, populationDensity: 4300 },
      { id: 'kr-incheon', countryId: 'SouthKorea', name: 'Incheon', lat: 37.4563, lng: 126.7052, population: 2965600, populationDensity: 2900 },
      { id: 'kr-daegu', countryId: 'SouthKorea', name: 'Daegu', lat: 35.8714, lng: 128.6014, population: 2366334, populationDensity: 2700 },
    ],
  },
  Israel: {
    alignment: 'west',
    weapons: [
      { name: 'Jericho III', deliveryType: 'ICBM', yield_kt: 20 },
    ],
    cities: [
      { id: 'il-jerusalem', countryId: 'Israel', name: 'Jerusalem', lat: 31.7683, lng: 35.2137, population: 936425, populationDensity: 7600, isCapital: true },
      { id: 'il-tel-aviv', countryId: 'Israel', name: 'Tel Aviv', lat: 32.0853, lng: 34.7818, population: 467875, populationDensity: 8400 },
      { id: 'il-haifa', countryId: 'Israel', name: 'Haifa', lat: 32.794, lng: 34.9896, population: 285316, populationDensity: 4100 },
      { id: 'il-beersheba', countryId: 'Israel', name: 'Beersheba', lat: 31.252, lng: 34.7915, population: 214162, populationDensity: 1800 },
    ],
  },
  Belarus: {
    alignment: 'east',
    weapons: [],
    cities: [
      { id: 'by-minsk', countryId: 'Belarus', name: 'Minsk', lat: 53.9006, lng: 27.559, population: 1992862, populationDensity: 5800, isCapital: true },
      { id: 'by-gomel', countryId: 'Belarus', name: 'Gomel', lat: 52.4345, lng: 30.9754, population: 501802, populationDensity: 2900 },
    ],
  },
  NorthKorea: {
    alignment: 'east',
    weapons: [
      { name: 'Hwasong-17', deliveryType: 'ICBM', yield_kt: 50 },
      { name: 'Pukguksong-3', deliveryType: 'SLBM', yield_kt: 10 },
    ],
    cities: [
      { id: 'kp-pyongyang', countryId: 'NorthKorea', name: 'Pyongyang', lat: 39.0392, lng: 125.7625, population: 3155388, populationDensity: 2100, isCapital: true },
      { id: 'kp-hamhung', countryId: 'NorthKorea', name: 'Hamhung', lat: 39.9183, lng: 127.5364, population: 768551, populationDensity: 1800 },
    ],
  },
  India: {
    alignment: 'wildcard',
    weapons: [
      { name: 'Agni-V', deliveryType: 'ICBM', yield_kt: 45 },
      { name: 'K-4', deliveryType: 'SLBM', yield_kt: 15 },
    ],
    cities: [
      { id: 'in-delhi', countryId: 'India', name: 'New Delhi', lat: 28.6139, lng: 77.209, population: 3290000, populationDensity: 11200, isCapital: true },
      { id: 'in-mumbai', countryId: 'India', name: 'Mumbai', lat: 19.076, lng: 72.8777, population: 12442373, populationDensity: 20500 },
      { id: 'in-bengaluru', countryId: 'India', name: 'Bengaluru', lat: 12.9716, lng: 77.5946, population: 8443675, populationDensity: 4400 },
      { id: 'in-kolkata', countryId: 'India', name: 'Kolkata', lat: 22.5726, lng: 88.3639, population: 4496694, populationDensity: 24200 },
      { id: 'in-chennai', countryId: 'India', name: 'Chennai', lat: 13.0827, lng: 80.2707, population: 4646732, populationDensity: 16500 },
      { id: 'in-hyderabad', countryId: 'India', name: 'Hyderabad', lat: 17.385, lng: 78.4867, population: 6993262, populationDensity: 10400 },
    ],
  },
  Pakistan: {
    alignment: 'wildcard',
    weapons: [
      { name: 'Shaheen-III', deliveryType: 'Ballistic missile', yield_kt: 40 },
      { name: 'Babur-3', deliveryType: 'SLBM', yield_kt: 10 },
    ],
    cities: [
      { id: 'pk-islamabad', countryId: 'Pakistan', name: 'Islamabad', lat: 33.6844, lng: 73.0479, population: 1014825, populationDensity: 2200, isCapital: true },
      { id: 'pk-karachi', countryId: 'Pakistan', name: 'Karachi', lat: 24.8607, lng: 67.0011, population: 14800000, populationDensity: 6000 },
      { id: 'pk-lahore', countryId: 'Pakistan', name: 'Lahore', lat: 31.5497, lng: 74.3436, population: 11126000, populationDensity: 7000 },
      { id: 'pk-rawalpindi', countryId: 'Pakistan', name: 'Rawalpindi', lat: 33.5651, lng: 73.0169, population: 2098231, populationDensity: 4600 },
      { id: 'pk-faisalabad', countryId: 'Pakistan', name: 'Faisalabad', lat: 31.4504, lng: 73.135, population: 3546888, populationDensity: 4800 },
    ],
  },
  Ukraine: {
    alignment: 'independent',
    weapons: [],
    cities: [
      { id: 'ua-kyiv', countryId: 'Ukraine', name: 'Kyiv', lat: 50.4501, lng: 30.5234, population: 2952301, populationDensity: 3400, isCapital: true },
      { id: 'ua-kharkiv', countryId: 'Ukraine', name: 'Kharkiv', lat: 49.9935, lng: 36.2304, population: 1410000, populationDensity: 4400 },
      { id: 'ua-odesa', countryId: 'Ukraine', name: 'Odesa', lat: 46.4825, lng: 30.7233, population: 1011000, populationDensity: 3800 },
      { id: 'ua-dnipro', countryId: 'Ukraine', name: 'Dnipro', lat: 48.4647, lng: 35.0462, population: 968502, populationDensity: 2400 },
    ],
  },
  Iran: {
    alignment: 'independent',
    weapons: [],
    cities: [
      { id: 'ir-tehran', countryId: 'Iran', name: 'Tehran', lat: 35.6892, lng: 51.389, population: 9559000, populationDensity: 12000, isCapital: true },
      { id: 'ir-mashhad', countryId: 'Iran', name: 'Mashhad', lat: 36.2605, lng: 59.6168, population: 3072000, populationDensity: 3000 },
      { id: 'ir-isfahan', countryId: 'Iran', name: 'Isfahan', lat: 32.6546, lng: 51.668, population: 2213000, populationDensity: 4900 },
      { id: 'ir-shiraz', countryId: 'Iran', name: 'Shiraz', lat: 29.5918, lng: 52.5837, population: 1869001, populationDensity: 4200 },
    ],
  },
  SaudiArabia: {
    alignment: 'independent',
    weapons: [],
    cities: [
      { id: 'sa-riyadh', countryId: 'SaudiArabia', name: 'Riyadh', lat: 24.7136, lng: 46.6753, population: 7676654, populationDensity: 1700, isCapital: true },
      { id: 'sa-jeddah', countryId: 'SaudiArabia', name: 'Jeddah', lat: 21.4858, lng: 39.1925, population: 4697000, populationDensity: 2800 },
      { id: 'sa-mecca', countryId: 'SaudiArabia', name: 'Mecca', lat: 21.3891, lng: 39.8579, population: 2324000, populationDensity: 3400 },
      { id: 'sa-medina', countryId: 'SaudiArabia', name: 'Medina', lat: 24.5247, lng: 39.5692, population: 1411000, populationDensity: 2400 },
    ],
  },
}

export const CITY_LOOKUP = Object.values(COUNTRY_PROFILES)
  .flatMap((profile) => profile.cities)
  .reduce<Record<string, CityProfile>>((lookup, city) => {
    lookup[city.id] = city
    return lookup
  }, {})
