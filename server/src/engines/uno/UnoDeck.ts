import crypto from 'crypto';
import { UnoCard, UnoColor, UnoMode, UnoValue } from './types';

const COLORS: UnoColor[] = ['red', 'blue', 'green', 'yellow'];
const NUMBERS: UnoValue[] = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

export class UnoDeck {
  public static createDeck(mode: UnoMode): UnoCard[] {
    switch (mode) {
      case 'no-mercy':
        return this.createNoMercyDeck();
      case 'flex':
        return this.createFlexDeck();
      case 'classic':
      default:
        return this.createClassicDeck();
    }
  }

  public static createClassicDeck(): UnoCard[] {
    const deck: UnoCard[] = [];

    for (const color of COLORS) {
      // One 0 per color
      deck.push({
        id: crypto.randomUUID(),
        color,
        value: '0',
        pointValue: 0
      });

      // Two 1-9 per color
      for (const val of NUMBERS.slice(1)) {
        for (let i = 0; i < 2; i++) {
          deck.push({
            id: crypto.randomUUID(),
            color,
            value: val,
            pointValue: parseInt(val, 10)
          });
        }
      }

      // Two Skip, Reverse, Draw Two per color
      const actions: { value: UnoValue; points: number }[] = [
        { value: 'skip', points: 20 },
        { value: 'reverse', points: 20 },
        { value: 'draw_two', points: 20 }
      ];

      for (const action of actions) {
        for (let i = 0; i < 2; i++) {
          deck.push({
            id: crypto.randomUUID(),
            color,
            value: action.value,
            pointValue: action.points
          });
        }
      }
    }

    // 4 Wild, 4 Wild Draw Four
    for (let i = 0; i < 4; i++) {
      deck.push({
        id: crypto.randomUUID(),
        color: 'wild',
        value: 'wild',
        pointValue: 50
      });
      deck.push({
        id: crypto.randomUUID(),
        color: 'wild',
        value: 'wild_draw_four',
        pointValue: 50
      });
    }

    return deck;
  }

  public static createNoMercyDeck(): UnoCard[] {
    const deck: UnoCard[] = [];

    for (const color of COLORS) {
      // 80 number cards: 0-9, each color 2 copies = 4 colors × 10 values × 2 = 80
      for (const val of NUMBERS) {
        for (let i = 0; i < 2; i++) {
          deck.push({
            id: crypto.randomUUID(),
            color,
            value: val,
            pointValue: parseInt(val, 10)
          });
        }
      }

      // 12 Draw Two: 3 per color
      for (let i = 0; i < 3; i++) {
        deck.push({
          id: crypto.randomUUID(),
          color,
          value: 'draw_two',
          pointValue: 20
        });
      }

      // 8 Colored Draw Four: 2 per color
      for (let i = 0; i < 2; i++) {
        deck.push({
          id: crypto.randomUUID(),
          color,
          value: 'draw_four',
          pointValue: 40
        });
      }

      // 12 Skip: 3 per color
      for (let i = 0; i < 3; i++) {
        deck.push({
          id: crypto.randomUUID(),
          color,
          value: 'skip',
          pointValue: 20
        });
      }

      // 12 Reverse: 3 per color
      for (let i = 0; i < 3; i++) {
        deck.push({
          id: crypto.randomUUID(),
          color,
          value: 'reverse',
          pointValue: 20
        });
      }

      // 12 Discard All: 3 per color
      for (let i = 0; i < 3; i++) {
        deck.push({
          id: crypto.randomUUID(),
          color,
          value: 'discard_all',
          pointValue: 30
        });
      }

      // 8 Skip Everyone: 2 per color
      for (let i = 0; i < 2; i++) {
        deck.push({
          id: crypto.randomUUID(),
          color,
          value: 'skip_everyone',
          pointValue: 30
        });
      }
    }

    // 8 Wild Draw 4 (+4 đen)
    for (let i = 0; i < 8; i++) {
      deck.push({
        id: crypto.randomUUID(),
        color: 'wild',
        value: 'wild_draw_four',
        pointValue: 50
      });
    }

    // 8 Wild Reverse Draw 4 (⇄ +4 đen)
    for (let i = 0; i < 8; i++) {
      deck.push({
        id: crypto.randomUUID(),
        color: 'wild',
        value: 'wild_reverse_draw_four',
        pointValue: 50
      });
    }

    // 6 Wild Color Roulette
    for (let i = 0; i < 6; i++) {
      deck.push({
        id: crypto.randomUUID(),
        color: 'wild',
        value: 'wild_color_roulette',
        pointValue: 50
      });
    }

    // 8 Wild Draw 6 (+6 đen)
    for (let i = 0; i < 8; i++) {
      deck.push({
        id: crypto.randomUUID(),
        color: 'wild',
        value: 'wild_draw_six',
        pointValue: 60
      });
    }

    // 8 Wild Draw 8 (+8 đen)
    for (let i = 0; i < 8; i++) {
      deck.push({
        id: crypto.randomUUID(),
        color: 'wild',
        value: 'wild_draw_eight',
        pointValue: 80
      });
    }

    // 8 Wild Draw 10 (+10 đen)
    for (let i = 0; i < 8; i++) {
      deck.push({
        id: crypto.randomUUID(),
        color: 'wild',
        value: 'wild_draw_ten',
        pointValue: 100
      });
    }

    return deck;
  }

  public static createFlexDeck(): UnoCard[] {
    const deck: UnoCard[] = [];
    const colorCycle: Record<UnoColor, UnoColor> = {
      red: 'blue',
      blue: 'yellow',
      yellow: 'green',
      green: 'red',
      wild: 'wild'
    };

    for (const color of COLORS) {
      const flexAltColor = colorCycle[color];

      // 0-9
      for (const val of NUMBERS) {
        deck.push({
          id: crypto.randomUUID(),
          color,
          value: val,
          flexColor: flexAltColor,
          flexValue: val,
          pointValue: parseInt(val, 10)
        });
      }

      // Draw Two -> Flex is Draw Four
      deck.push({
        id: crypto.randomUUID(),
        color,
        value: 'draw_two',
        flexColor: flexAltColor,
        flexValue: 'wild_draw_four',
        pointValue: 20
      });

      // Skip -> Flex is Skip Everyone
      deck.push({
        id: crypto.randomUUID(),
        color,
        value: 'skip',
        flexColor: flexAltColor,
        flexValue: 'skip_everyone',
        pointValue: 20
      });

      // Reverse
      deck.push({
        id: crypto.randomUUID(),
        color,
        value: 'reverse',
        flexColor: flexAltColor,
        flexValue: 'reverse',
        pointValue: 20
      });

      // Flex All Flip cards
      deck.push({
        id: crypto.randomUUID(),
        color,
        value: 'flex_all_flip',
        flexColor: 'wild',
        flexValue: 'flex_all_flip',
        pointValue: 25
      });
    }

    // Wilds
    for (let i = 0; i < 4; i++) {
      deck.push({
        id: crypto.randomUUID(),
        color: 'wild',
        value: 'wild',
        flexColor: 'wild',
        flexValue: 'wild_draw_two' as any,
        pointValue: 50
      });
      deck.push({
        id: crypto.randomUUID(),
        color: 'wild',
        value: 'wild_draw_four',
        flexColor: 'wild',
        flexValue: 'wild_draw_six',
        pointValue: 50
      });
    }

    return deck;
  }
}
