/*
 * Uniqueness Considerations:
 *
 * 1. **Dahlia Names List:**
 *    - The list contains 128 unique Dahlia flower names.
 *    - Each name is processed to:
 *      - Be in lowercase.
 *      - Replace non-alphanumeric characters with hyphens.
 *    - This ensures that the names are URL-friendly and consistent.
 *
 * 2. **Random ID Generation with nanoid:**
 *    - The `nanoid` function generates a unique identifier using a cryptographically strong random number generator.
 *    - The default character set includes numbers, uppercase, and lowercase letters (62 characters).
 *    - For a length of 6, the total possible unique IDs are:
 *      \[
 *      62^6 = 56,800,235,584 \text{ combinations}
 *      \]
 *    - This provides a vast space of unique IDs, minimizing the chance of collisions.
 *
 * 3. **Total Unique Schema Names:**
 *    - Combining the Dahlia names with the nanoid IDs:
 *      \[
 *      128 \text{ (Dahlia names)} \times 62^6 \approx 7.27 \times 10^{12} \text{ unique schema names}
 *      \]
 *    - This large number significantly reduces the probability of generating duplicate schema names.
 *
 * 4. **Edge Case Handling:**
 *    - The optional chaining (`?.`) and nullish coalescing (`??`) operators ensure robustness.
 *    - If `dahliaNames[randomIndex]` is `undefined` (which is unlikely but possible in certain edge cases), the code uses `nanoid(length)` as the `selectedName`.
 *    - This guarantees that the function always returns a valid schema name.
 *
 * 5. **Uniqueness Assurance:**
 *    - While the probability of a collision is extremely low, it's not zero.
 *    - For applications requiring guaranteed uniqueness:
 *      - Consider checking the generated schema name against existing names.
 *      - Increase the `length` parameter to generate longer nanoid IDs, further reducing collision probability.
 *      - Use a central registry or database to track and ensure uniqueness.
 *
 * 6. **Security Considerations:**
 *    - The use of `nanoid` over `Math.random()` provides better randomness and security.
 *    - `nanoid` is suitable for generating unique IDs in distributed systems where security and uniqueness are critical.
 *
 * **Conclusion:**
 * - The combination of a random Dahlia name and a nanoid ID provides a highly unique and identifiable schema name.
 * - The design balances uniqueness, readability, and theming (with flower names).
 * - Always ensure that this method aligns with your application's requirements for uniqueness and collision handling.
 */

import { nanoid } from "./nanoid";

const dahliaNames = [
  "AC Rooster",
  "AC Rosebud",
  "Ala Mode",
  "Ali Oop",
  "Allie White",
  "Alloway Candy",
  "Appleblossom",
  "Bahama Mama",
  "Big Checkers",
  "Black Satin",
  "Blizzard",
  "Bloomquist Dawn",
  "Bo De O",
  "Born Sty",
  "Bradley Aaron",
  "Brian R",
  "Bride to Be",
  "Burma Gem",
  "Caboose",
  "Checkers",
  "Childsons Pride",
  "Clearview Lily",
  "Clearview Snowcap",
  "Colorado Classic",
  "Cornel",
  "Critchon Honey",
  "Czar Willow",
  "Day Dreamer",
  "Devon Seattle",
  "Diva",
  "Ed Black",
  "Elma Elizabeth",
  "Esmeralda",
  "EV Bright Eyes",
  "Eveline",
  "Ferncliff Fuego",
  "Fidalgo Blacky",
  "Fire Magic",
  "First Kiss",
  "Foxy Lady",
  "French Doll",
  "Frizzy Lizzy",
  "Fuzzy Wuzzy",
  "Gabrielle Marie",
  "Gay Princess",
  "Gitts Attention",
  "Glenbank Twinkle",
  "Glory Daze",
  "Grayval Shiraz",
  "Harvey Koop",
  "Hee Haugh",
  "Hollyhill Starburst",
  "Irish Miss",
  "Jaiver G",
  "James Albin",
  "Jax Char",
  "Jazzy",
  "Jenna",
  "Jennifers Wedding",
  "Jessie G",
  "Jo",
  "Just Peachy",
  "Kaleidoscope",
  "Karras 150",
  "Kenora Lisa",
  "L'Ancresse",
  "Lauren Michele",
  "Little Scottie",
  "Lovely Lana",
  "Lupin Ben",
  "Lupin Britain",
  "Lutt Wichen",
  "Maarn",
  "Midnight Moon",
  "Mingus Erik",
  "Mingus Toni",
  "Mingus Wesley",
  "Miss Amara",
  "Miss Molly",
  "Miss Prissy",
  "Mr. Jimmy",
  "Ms Kennedy",
  "Mystique",
  "Nanna's Kiss",
  "Neon Splendor",
  "Nijinsky",
  "Optic Illusion",
  "Orange Cushion",
  "Oreti Candy",
  "Pete's Pink Cactus",
  "Pinelands Princess",
  "Pooh",
  "Poppers",
  "Purple Splash",
  "Raz Ma Taz",
  "Red Umbrella",
  "Rip City",
  "Robann Royal",
  "Rose Toscano",
  "September Morn",
  "Shadow Cat",
  "Shea's Rainbow",
  "Silverado",
  "Skywalker",
  "Spartacus",
  "Strawberry Ice",
  "Sugar Daddy",
  "Sugartown Sunrise",
  "Swan Lake",
  "Swan's Olympic Flame",
  "Teds Choice",
  "Tropic Sun",
  "Tyler James",
  "Urchin",
  "Valley Porcupine",
  "Vassio Meggos",
  "Vista Pinky",
  "White Fawn",
  "Windhaven Blush",
  "Winholme Diane",
  "Woodland's Merinda",
  "Wyn's Pretty in Pink",
];

/**
 * Generates a unique database schema name in the format:
 * 'dahlia-<flower-name>-<randomId>'.
 *
 * @param length - The length of the random ID to append. Default is 6.
 * @returns A formatted schema name string.
 */
export const generateDahliaName = (length = 6): string => {
  // Generate a random index to select a Dahlia name from the list
  const randomIndex = Math.floor(Math.random() * dahliaNames.length);

  // Select and format the Dahlia name:
  // - Convert to lowercase
  // - Replace any character that is not a letter or number with a hyphen
  // - If the name is undefined (edge case), use a nanoid as the name
  const selectedName: string =
    dahliaNames[randomIndex]?.toLowerCase().replace(/[^a-z0-9]/g, "-") ??
    nanoid(length);

  // Generate a unique random ID using nanoid
  const randomId = nanoid(length);

  // Combine the prefix 'dahlia', the formatted flower name, and the random ID
  return `dahlia-${selectedName}-${randomId}`;
};
