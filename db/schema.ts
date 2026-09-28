import {integer,sqliteTable,text} from 'drizzle-orm/sqlite-core';
export const venues=sqliteTable('venues',{owner:text('owner').primaryKey(),state:text('state').notNull(),version:integer('version').notNull().default(0)});
export const accesses=sqliteTable('accesses',{hash:text('hash').primaryKey(),owner:text('owner').notNull().references(()=>venues.owner),employee:text('employee').notNull()});

export const printers=sqliteTable('printers',{owner:text('owner').primaryKey().references(()=>venues.owner),hash:text('hash').notNull()});
