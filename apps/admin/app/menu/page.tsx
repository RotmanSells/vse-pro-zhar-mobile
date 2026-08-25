import { createCategoryAction } from './category-actions';
import { CategoryCreateForm } from './category-create-form';

export default function MenuPage(): React.ReactElement {
  return (
    <section>
      <h1>Menu</h1>
      <p>Create a Category for the development/test catalog.</p>
      <CategoryCreateForm createCategory={createCategoryAction} />
    </section>
  );
}
