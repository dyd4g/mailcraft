import type {Brand,Block,EmailContent,TemplateMetadata} from './model';
/** A portable, data-only onboarding snapshot. No source code or credentials. */
export type ClientPack={
 format:'mailcraft-client-pack-v1';
 client:{id:string;name:string;brand:Brand};
 email:{id:string;title:string;content:EmailContent};
 template?:{id:string;name:string;metadata:TemplateMetadata};
 assets:{id:string;name:string;url:string}[];
 components:{id:string;name:string;content:Block}[];
};
export type DesignPack={
 format:'mailcraft-design-pack-v1';
 clientId:string;
 designs:{id:string;title:string;content:EmailContent;template?:{id:string;name:string;metadata:TemplateMetadata}}[];
};
