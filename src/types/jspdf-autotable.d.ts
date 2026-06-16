// Type augmentation for jspdf-autotable
// jspdf-autotable adds lastAutoTable to the jsPDF instance at runtime,
// but its type definitions don't declare it on the jsPDF class.
import 'jspdf';

declare module 'jspdf' {
  interface jsPDF {
    lastAutoTable: {
      finalY: number;
    };
  }
}
