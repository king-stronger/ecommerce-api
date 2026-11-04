export type AddressSnapshot = {
	firstName: string;
	lastName?: string;
	company?: string;
	phone?: string;
	addressLine1: string;
	addressLine2?: string;
	city: string;
	state: string;
	postalCode: string;
	country: string;
};

export type ProductImage = {
	url: string;
	alt?: string;
	sort?: number;
};
