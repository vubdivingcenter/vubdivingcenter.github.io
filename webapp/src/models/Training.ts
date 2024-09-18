import { Trainer } from "./Trainer";

export interface Training {
    startTime: Date;
    endTime: Date;
    subject?: string;
    trainer?: Trainer;
}
