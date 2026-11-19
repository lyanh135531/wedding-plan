import { z } from 'zod';
import { dateTimeStringSchema,uuidSchema,notesSchema } from './common';
export const appointmentSchema=z.object({title:z.string().trim().min(1).max(255),startTime:dateTimeStringSchema,endTime:dateTimeStringSchema,eventId:uuidSchema.nullable().optional(),location:z.string().max(1000).nullable().optional(),attendees:z.string().max(1000).nullable().optional(),notes:notesSchema.optional(),sharedWithFamily:z.boolean().default(false)}).refine(v=>new Date(v.endTime)>=new Date(v.startTime),{message:'Giờ kết thúc phải sau giờ bắt đầu.',path:['endTime']});
