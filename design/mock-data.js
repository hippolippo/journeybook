window.JB_SEED = {
  nodes: [
    { id: 'f1', type: 'folder', title: 'Us', parentId: null, order: 0 },
    { id: 'f2', type: 'folder', title: 'Trips', parentId: null, order: 1 },
    { id: 'b7', type: 'scrapbook', title: 'Everyday', parentId: null, order: 2, cover: 'sage' },

    { id: 'b1', type: 'scrapbook', title: 'First hello', parentId: 'f1', order: 0, cover: 'rose',
      pages: [
        { id: 'b1p1', elements: [
          { kind: 'photo', photo: 'blush', caption: 'us, day one', rot: -3 },
          { kind: 'sticker', icon: 'heart', rot: -8 },
          { kind: 'note', text: 'I still get butterflies when your name pops up on my phone.', rot: 2 }
        ] },
        { id: 'b1p2', elements: [
          { kind: 'photo', photo: 'night', caption: '3am talks', rot: 2 },
          { kind: 'note', text: 'We said we would just say goodnight. We did not.', rot: -1.5 }
        ] },
        { id: 'b1p3', elements: [
          { kind: 'sticker', icon: 'sparkle', rot: 0 },
          { kind: 'note', text: 'Twelve hours apart, zero kilometres between us.', rot: 3 }
        ] }
      ]
    },
    { id: 'b2', type: 'scrapbook', title: 'Little things', parentId: 'f1', order: 1, cover: 'mustard',
      pages: [
        { id: 'b2p1', elements: [
          { kind: 'photo', photo: 'meadow', caption: 'your laugh, Wednesday', rot: -2 },
          { kind: 'sticker', icon: 'star', rot: 6 }
        ] },
        { id: 'b2p2', elements: [
          { kind: 'note', text: 'You hum when you are happy. I noticed. I always notice.', rot: -2 }
        ] }
      ]
    },
    { id: 'f3', type: 'folder', title: 'Inside jokes', parentId: 'f1', order: 2 },
    { id: 'b3', type: 'scrapbook', title: 'The raccoon incident', parentId: 'f3', order: 0, cover: 'terracotta',
      pages: [
        { id: 'b3p1', elements: [
          { kind: 'photo', photo: 'forest', caption: 'the culprit', rot: 2 },
          { kind: 'note', text: 'We do not speak of the bins.', rot: -3 }
        ] }
      ]
    },

    { id: 'f4', type: 'folder', title: '2024', parentId: 'f2', order: 0 },
    { id: 'b4', type: 'scrapbook', title: 'Lisbon', parentId: 'f4', order: 0, cover: 'sky',
      pages: [
        { id: 'b4p1', elements: [
          { kind: 'photo', photo: 'sunset', caption: 'the miradouro', rot: -2 },
          { kind: 'sticker', icon: 'sparkle', rot: 10 }
        ] },
        { id: 'b4p2', elements: [
          { kind: 'photo', photo: 'sea', caption: 'tram 28, again', rot: 3 },
          { kind: 'note', text: 'Pastéis de nata count: eleven. No regrets.', rot: -2 }
        ] },
        { id: 'b4p3', elements: [
          { kind: 'note', text: 'You fell asleep on my shoulder on the train and I did not move for an hour.', rot: 1 }
        ] },
        { id: 'b4p4', elements: [
          { kind: 'sticker', icon: 'heart', rot: -6 },
          { kind: 'note', text: 'Next time: the Algarve.', rot: 2 }
        ] }
      ]
    },
    { id: 'b5', type: 'scrapbook', title: 'Cabin weekend', parentId: 'f4', order: 1, cover: 'kraft', pages: [] },
    { id: 'b6', type: 'scrapbook', title: 'Someday list', parentId: 'f2', order: 1, cover: 'rose',
      pages: [
        { id: 'b6p1', elements: [
          { kind: 'note', text: 'Things we will do when the distance is done:', rot: -2 },
          { kind: 'note', text: '1. Adopt a cat with an unimpressed face.', rot: 1 },
          { kind: 'sticker', icon: 'star', rot: -10 }
        ] }
      ]
    }
  ]
};
