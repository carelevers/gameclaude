// Empty seats are filled with generated club players. Every seat taken by a
// community-designed player (content/players/*.json) is one filler fewer.
const FIRST = ['Anouk', 'Bram', 'Chloe', 'Daan', 'Esra', 'Finn', 'Gita', 'Hugo', 'Ilse', 'Jesse', 'Kiki', 'Lars', 'Mila', 'Noor', 'Omar', 'Pim', 'Quinn', 'Rosa', 'Sem', 'Tess', 'Umut', 'Vera', 'Wout', 'Xena', 'Yara', 'Zeb'];
const LAST = ['Bakker', 'de Jong', 'Jansen', 'Visser', 'Smit', 'Mulder', 'Bos', 'Vos', 'Peters', 'Hendriks', 'Dekker', 'Brouwer', 'de Wit', 'Dijkstra', 'Kok', 'Vermeulen'];
const COLORS = ['r', 'o', 'y', 'l', 'g', 't', 'b', 'c', 'a', 'p', 's'];

export function fillerPersona(rng, seat) {
  const color = rng.pick(COLORS);
  return {
    id: `filler_${seat}`,
    name: `${rng.pick(FIRST)} ${rng.pick(LAST)}`,
    author: 'open seat',
    bio: 'A generated club player. Design a real character to take this seat!',
    accuracy: rng.int(15, 65),
    nerves: rng.int(10, 80),
    color,
    avatar: ['..' + color.repeat(4) + '..', '.' + color.repeat(6) + '.', '.' + color + 'k' + color.repeat(2) + 'k' + color + '.', '.' + color.repeat(6) + '.', '..' + color.repeat(4) + '..', '...ss...', '.ssssss.', 'ssssssss'],
    catchphrases: [],
    filler: true,
  };
}
