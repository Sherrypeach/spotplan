import { CLASSROOM_DOCUMENT_VERSION, type ClassroomDocument, type DocStudent } from '@modules/classroom/document';

/** A new, empty class, as the API creates it (api: new-classroom-document.ts). */
export function emptyDoc(): ClassroomDocument {
  return {
    version: CLASSROOM_DOCUMENT_VERSION,
    students: [],
    keepApart: [],
    colors: {
      enabled: false,
      tags: ['Pink', 'Orange', 'Blue', 'Purple'].map((name) => ({ name, inUse: true })),
    },
    settings: {
      balanceColors: true,
      usePastCharts: true,
      askLevelQuestions: false,
      firstNamesOnly: true,
      feedback: { spreadOutOnes: 0, onesCloserToMe: 0, fewerOnesPerTable: 0 },
    },
    room: {
      shape: 'rectangle',
      width: 1086,
      depth: 869,
      pieces: [],
      layout: null,
      seats: [],
      spots: [],
      labels: {},
      handSetLabels: [],
      locked: false,
    },
    seating: { assignment: {}, lockedSeats: [], checkedOff: [] },
    history: [],
    savedCharts: [],
    chart: {
      title: 'Office Seating Chart',
      subtitle: '',
      view: 'seats',
      showDoors: true,
      showColors: false,
      showDirections: true,
      showList: false,
      style: 'classroom',
      showFurniture: true,
      showWindows: true,
      showRug: true,
      directions: [],
    },
  };
}

export function student(id: string, name: string, level: DocStudent['level'] = null): DocStudent {
  return { id, name, level, color: null, needs: {}, note: '' };
}

export function docWith(students: DocStudent[]): ClassroomDocument {
  return { ...emptyDoc(), students };
}
