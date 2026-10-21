import type { Player } from "@/types";

const doubles = [
  ["T01", "Sachin Thakur", "Ranjeet Gavali"], ["T02", "Harsh Shivhare", "Taher Khopoliwala"],
  ["T03", "Sunil Muttepawar", "Siddharth Singh"], ["T04", "Aditya Kadam", "Parv Javheri"],
  ["T05", "Mahendra Patil", "Vaibhav Tandale"], ["T06", "Praveen Mane", "Vaibhav Kumbhar"],
  ["T07", "Sanskar Jamadar", "Mahesh Jadhav"], ["T08", "Mayank Atmapooja", "Prakalp Jain"],
  ["T09", "Videhi Bavishi", "Ajay Dwarkunde"], ["T10", "Kedar Arun Joshi", "Pradeep Nagar"],
  ["T11", "Vikas Tamboli", "Shivaditya Ingle"], ["T12", "Bhushan Puri", "Kiran Lokhande"],
  ["T13", "Aakash Khopade", "Aditya Bhairavkar"], ["T14", "Tanmay Karale", "Shubham Khandelwal"],
  ["T15", "Suyash Ukidve", "Madhu Harsha"], ["T16", "Nikesh Chatrani", "Bharatkumar Bangad"],
] as const;

const singles = [
  ["WS01", "Shubhashri"], ["WS02", "Apurva"], ["WS03", "Ashwini Tanpure"],
  ["WS04", "Bandana Kaur Cheema"], ["WS05", "Moulika Kulkarni"], ["WS06", "Gauri Dhengekar"],
  ["WS07", "Nikita Borgaonkar"], ["WS08", "Shruti Mishra"], ["WS09", "Videhi Bavishi"],
] as const;

export const players: Player[] = [
  ...doubles.flatMap(([teamId, first, second]) => [
    { id: `${teamId}-P1`, name: first, department: "" },
    { id: `${teamId}-P2`, name: second, department: "" },
  ]),
  ...singles.map(([id, name]) => ({ id: `${id}-P1`, name, department: "" })),
];
